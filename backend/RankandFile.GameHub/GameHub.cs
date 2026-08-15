using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using RankandFile.Core.Models;
using RankandFile.Core.Repositories;
using RankandFile.Core.Services;

namespace RankandFile.GameHub;

public class GameHub : Hub
{
    private const int MinPlayers = 2;
    private static readonly int[] AllowedMaxRounds = { 1, 2, 3 };

    // One semaphore per active session serialises concurrent SubmitRanking /
    // SubmitGuess calls so the Cosmos read-modify-write never races itself.
    // This works correctly on a single App Service instance; for multi-instance
    // deployments replace with a Redis distributed lock.
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _sessionLocks = new();

    // connectionId -> which player in which session, so a disconnect can be
    // attributed without scanning every session. Same single-instance caveat as
    // the locks above; if the process restarts the map is empty and a drop goes
    // unnoticed until that player's next action, which is a degraded but safe
    // state rather than a wrong one.
    private static readonly ConcurrentDictionary<string, (string SessionCode, string PlayerId)> _connections = new();

    private readonly SessionRepository _repo;
    private readonly CardGeneratorService _cardGen;
    private readonly PairingService _pairingService;
    private readonly ScoringService _scoringService;
    private readonly ConsensusService _consensusService;

    public GameHub(SessionRepository repo, CardGeneratorService cardGen,
                   PairingService pairingService, ScoringService scoringService,
                   ConsensusService consensusService)
    {
        _repo = repo;
        _cardGen = cardGen;
        _pairingService = pairingService;
        _scoringService = scoringService;
        _consensusService = consensusService;
    }

    // ===================== Join / create =====================

    /// <summary>
    /// Joins a session, or re-attaches an existing player after a refresh or a
    /// dropped connection. <paramref name="playerId"/> is the client's durable
    /// id — matching on it (rather than the ConnectionId) is what makes a
    /// reconnect resume the same player instead of spawning a duplicate.
    /// </summary>
    public async Task JoinSession(string sessionCode, string playerName, string playerId)
    {
        var sem = _sessionLocks.GetOrAdd(sessionCode, _ => new SemaphoreSlim(1, 1));
        await sem.WaitAsync();
        try
        {
            if (!NameValidator.IsClean(playerName))
            {
                await Clients.Caller.SendAsync("Error", NameValidator.RejectedMessage);
                return;
            }

            var session = await _repo.GetSessionAsync(sessionCode);
            if (session == null)
            {
                await Clients.Caller.SendAsync("Error", $"Session '{sessionCode}' not found.");
                return;
            }

            var existing = session.Players.FirstOrDefault(p => p.PlayerId == playerId);
            if (existing != null)
            {
                existing.ConnectionId = Context.ConnectionId;
                existing.IsConnected = true;
                existing.Name = playerName; // keep the roster showing their current name
            }
            else
            {
                session.Players.Add(new Player
                {
                    PlayerId = playerId,
                    Name = playerName,
                    ConnectionId = Context.ConnectionId,
                    IsConnected = true,
                });
            }

            _connections[Context.ConnectionId] = (sessionCode, playerId);
            await Groups.AddToGroupAsync(Context.ConnectionId, sessionCode);
            await _repo.SaveSessionAsync(session);

            await Clients.Group(sessionCode).SendAsync("SessionUpdated", session);

            // Re-entering mid-round: hand the caller the round in progress so they
            // resume where the room actually is, rather than sitting in the lobby
            // while everyone else plays. Their earlier ranking, if any, is still
            // recorded, and the submit guards make a repeat submission a no-op.
            if (session.Status == "Playing" && session.Rounds.Count > 0)
            {
                var current = session.Rounds.Last();
                if (!current.RoundEnded)
                    await Clients.Caller.SendAsync("RoundStarted", current);
            }

            // A returning player restores the expected head-count, but the room
            // may have finished without them while they were away.
            await EvaluateRoundProgressAsync(session, sessionCode);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Failed to join session: {ex.Message}");
        }
        finally
        {
            sem.Release();
        }
    }

    public async Task CreateSession(string playerName, string playerId)
    {
        try
        {
            if (!NameValidator.IsClean(playerName))
            {
                await Clients.Caller.SendAsync("Error", NameValidator.RejectedMessage);
                return;
            }

            // Retry until we get an unused code (collision protection)
            string sessionCode;
            do
            {
                sessionCode = GenerateSessionCode();
            } while (await _repo.GetSessionAsync(sessionCode) != null);

            var session = new Session
            {
                SessionCode = sessionCode,
                HostPlayerId = playerId,
            };

            session.Players.Add(new Player
            {
                PlayerId = playerId,
                Name = playerName,
                ConnectionId = Context.ConnectionId,
                IsConnected = true,
            });

            _connections[Context.ConnectionId] = (sessionCode, playerId);
            await Groups.AddToGroupAsync(Context.ConnectionId, sessionCode);
            await _repo.SaveSessionAsync(session);

            await Clients.Group(sessionCode).SendAsync("SessionUpdated", session);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Failed to create session: {ex.Message}");
        }
    }

    /// <summary>
    /// Marks the player away, hands off the host role if they held it, and then
    /// re-checks round progress: the people still present may already have
    /// submitted everything the round was waiting on.
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_connections.TryRemove(Context.ConnectionId, out var info))
        {
            var sem = _sessionLocks.GetOrAdd(info.SessionCode, _ => new SemaphoreSlim(1, 1));
            await sem.WaitAsync();
            try
            {
                var session = await _repo.GetSessionAsync(info.SessionCode);
                var player = session?.Players.FirstOrDefault(p => p.PlayerId == info.PlayerId);

                // Ignore a stale disconnect that lands after the player already
                // reconnected on a newer transport.
                if (session != null && player != null && player.ConnectionId == Context.ConnectionId)
                {
                    player.IsConnected = false;
                    session.PromoteHostIfNeeded();
                    await _repo.SaveSessionAsync(session);
                    await Clients.Group(info.SessionCode).SendAsync("SessionUpdated", session);
                    await EvaluateRoundProgressAsync(session, info.SessionCode);
                }
            }
            catch
            {
                // Never let cleanup failure escape a disconnect.
            }
            finally
            {
                sem.Release();
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ===================== Lobby options =====================

    /// <summary>How the cards read: "normal" | "meme". Host-only, lobby-only.</summary>
    public async Task SetCardMode(string sessionCode, string cardMode)
    {
        await SetLobbyOption(sessionCode, "card mode", session =>
            session.CardMode = cardMode == "meme" ? "meme" : "normal");
    }

    /// <summary>
    /// What a round does: "icebreaker" (pair and guess) | "conference" (aggregate
    /// the whole room). Host-only, lobby-only.
    /// </summary>
    public async Task SetGameMode(string sessionCode, string gameMode)
    {
        await SetLobbyOption(sessionCode, "game mode", session =>
            session.GameMode = gameMode == "conference" ? "conference" : "icebreaker");
    }

    /// Shared guard for host-only options that may only change before kickoff.
    private async Task SetLobbyOption(string sessionCode, string label, Action<Session> apply)
    {
        try
        {
            var session = await _repo.GetSessionAsync(sessionCode);
            if (session == null)
            {
                await Clients.Caller.SendAsync("Error", "Session not found.");
                return;
            }

            if (!IsHost(session) || session.Status != "Lobby") return;

            apply(session);
            await _repo.SaveSessionAsync(session);
            await Clients.Group(sessionCode).SendAsync("SessionUpdated", session);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Failed to set {label}: {ex.Message}");
        }
    }

    // ===================== Rounds =====================

    public async Task StartNewRound(string sessionCode, int maxRounds = 2)
    {
        try
        {
            var session = await _repo.GetSessionAsync(sessionCode);
            if (session == null)
            {
                await Clients.Caller.SendAsync("Error", "Session not found.");
                return;
            }

            // Only the host advances the game — previously unguarded, which let
            // any player start a round.
            if (!IsHost(session)) return;

            if (session.ConnectedCount < MinPlayers)
            {
                await Clients.Caller.SendAsync("Error", $"Need at least {MinPlayers} players to start.");
                return;
            }

            // Lock in the round count on the very first round; ignore on subsequent calls.
            if (session.CurrentRound == 0)
            {
                session.MaxRounds = AllowedMaxRounds.Contains(maxRounds) ? maxRounds : 2;
                // GameMode is set separately via SetGameMode before the round starts.
                // Broadcast the updated session so every client immediately sees the
                // correct MaxRounds value before the first RoundStarted fires.
                await _repo.SaveSessionAsync(session);
                await Clients.Group(sessionCode).SendAsync("SessionUpdated", session);
            }

            if (session.CurrentRound >= session.MaxRounds)
            {
                session.Status = "Finished";
                await _repo.SaveSessionAsync(session);
                await Clients.Group(sessionCode).SendAsync("GameOver",
                    session.Players.OrderByDescending(p => p.TotalScore).ToList());
                return;
            }

            session.CurrentRound++;
            var round = new Round { RoundNum = session.CurrentRound };

            round.Cards = _cardGen.GenerateRoundCards();

            // Conference rounds have no matching engine — everyone ranks, and the
            // room is aggregated instead. Pairings/Triple stay empty.
            if (!session.IsConference)
            {
                // Pair only people who are actually here, or someone gets handed
                // an absent partner whose ranking will never arrive.
                var lookup = new HashSet<string>(session.PreviousPairs);
                var (pairings, triple) = _pairingService.CreatePairings(session.ConnectedPlayers, lookup);
                round.Pairings = pairings;
                round.Triple = triple;

                // Persist updated previous pairs back to the list
                session.PreviousPairs = lookup.ToList();
            }

            session.Rounds.Add(round);
            session.Status = "Playing";

            await _repo.SaveSessionAsync(session);

            await Clients.Group(sessionCode).SendAsync("RoundStarted", round);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Failed to start round: {ex.Message}");
        }
    }

    public async Task SubmitRanking(string sessionCode, List<string> rankedNouns)
    {
        var sem = _sessionLocks.GetOrAdd(sessionCode, _ => new SemaphoreSlim(1, 1));
        await sem.WaitAsync();
        try
        {
            var session = await _repo.GetSessionAsync(sessionCode);
            if (session == null)
            {
                await Clients.Caller.SendAsync("Error", "Session not found when submitting ranking.");
                return;
            }

            var playerId = ResolvePlayerId(session);
            if (playerId == null)
            {
                await Clients.Caller.SendAsync("Error", "You are not registered in this session.");
                return;
            }

            if (session.Rounds.Count == 0)
            {
                await Clients.Caller.SendAsync("Error", "No active round found for ranking submission.");
                return;
            }

            var currentRound = session.Rounds.Last();

            // Idempotency guard — handles double-submit (manual + auto-submit at t=0).
            if (currentRound.Rankings.ContainsKey(playerId)) return;

            currentRound.Rankings[playerId] = rankedNouns;
            await _repo.SaveSessionAsync(session);

            if (session.IsConference)
            {
                await Clients.Group(sessionCode).SendAsync("RankingProgress", new
                {
                    Submitted = session.SubmittedRankingCount(currentRound),
                    Total = session.ConnectedCount,
                });
            }

            await EvaluateRoundProgressAsync(session, sessionCode);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Failed to submit ranking: {ex.Message}");
        }
        finally
        {
            sem.Release();
        }
    }

    public async Task SubmitGuess(string sessionCode, string targetPlayerId, List<string> guessedRanking)
    {
        var sem = _sessionLocks.GetOrAdd(sessionCode, _ => new SemaphoreSlim(1, 1));
        await sem.WaitAsync();
        try
        {
            var session = await _repo.GetSessionAsync(sessionCode);
            if (session == null)
            {
                await Clients.Caller.SendAsync("Error", "Session not found when submitting guess.");
                return;
            }

            // Conference mode has no matching engine and therefore no guessing.
            if (session.IsConference) return;

            var playerId = ResolvePlayerId(session);
            if (playerId == null)
            {
                await Clients.Caller.SendAsync("Error", "You are not registered in this session.");
                return;
            }

            if (session.Rounds.Count == 0)
            {
                await Clients.Caller.SendAsync("Error", "No active round found for guess submission.");
                return;
            }

            var currentRound = session.Rounds.Last();

            // Security: validate the guesser is actually paired with this target.
            if (!currentRound.Pairings.TryGetValue(playerId, out var expectedTarget)
                || expectedTarget != targetPlayerId)
            {
                await Clients.Caller.SendAsync("Error", "You are not paired with that player this round.");
                return;
            }

            // Idempotency guard — handles double-submit (manual + auto-submit at t=0).
            if (currentRound.ScoresThisRound.ContainsKey(playerId)) return;

            var targetPlayer = session.Players.FirstOrDefault(p => p.PlayerId == targetPlayerId);

            if (!currentRound.Rankings.TryGetValue(targetPlayerId, out var actualRanking))
            {
                // The partner left before ranking, so there is nothing to score
                // against. Record a zero anyway: previously this returned an error,
                // which trapped the guesser on a screen they could never leave AND
                // withheld the score the round was waiting on, hanging everyone.
                currentRound.ScoresThisRound[playerId] = 0;
                await _repo.SaveSessionAsync(session);

                await Clients.Caller.SendAsync("GuessResult", new
                {
                    TargetName = targetPlayer?.Name ?? "your partner",
                    Score = 0d,
                    Actual = new List<string>(),
                    Guessed = guessedRanking,
                    MatchInfo = new Dictionary<string, string>(),
                    PartnerDropped = true,
                });

                await EvaluateRoundProgressAsync(session, sessionCode);
                return;
            }

            var (score, matchInfo) = _scoringService.CalculateScore(actualRanking, guessedRanking);

            currentRound.ScoresThisRound[playerId] = score;

            var guesser = session.Players.FirstOrDefault(p => p.PlayerId == playerId);
            if (guesser != null) guesser.TotalScore += score;

            await _repo.SaveSessionAsync(session);

            if (targetPlayer != null)
            {
                await Clients.Caller.SendAsync("GuessResult", new
                {
                    TargetName = targetPlayer.Name,
                    Score = score,
                    Actual = actualRanking,
                    Guessed = guessedRanking,
                    MatchInfo = matchInfo,
                    PartnerDropped = false,
                });
            }

            await EvaluateRoundProgressAsync(session, sessionCode);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Failed to submit guess: {ex.Message}");
        }
        finally
        {
            sem.Release();
        }
    }

    /// <summary>
    /// Conference mode: publish the room's aggregate now rather than waiting out
    /// the clock. Called by the host's timer and by the manual control; the
    /// server also closes the round on its own once everyone present has ranked.
    /// </summary>
    public async Task CloseRankings(string sessionCode)
    {
        var sem = _sessionLocks.GetOrAdd(sessionCode, _ => new SemaphoreSlim(1, 1));
        await sem.WaitAsync();
        try
        {
            var session = await _repo.GetSessionAsync(sessionCode);
            if (session == null)
            {
                await Clients.Caller.SendAsync("Error", "Session not found.");
                return;
            }

            if (!session.IsConference || !IsHost(session) || session.Rounds.Count == 0) return;

            if (await CloseConferenceRoundAsync(session, sessionCode))
                await _repo.SaveSessionAsync(session);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Failed to close rankings: {ex.Message}");
        }
        finally
        {
            sem.Release();
        }
    }

    // ===================== Progress evaluation =====================

    /// <summary>
    /// Single place that decides whether a round can move on. Runs after every
    /// submission, every disconnect and every rejoin, because all three change
    /// either the numerator or the denominator of "is everyone done yet".
    /// </summary>
    private async Task EvaluateRoundProgressAsync(Session session, string sessionCode)
    {
        if (session.Rounds.Count == 0 || session.Status == "Finished") return;

        var round = session.Rounds.Last();
        if (session.ConnectedCount == 0) return; // nobody left to advance for

        var dirty = false;

        if (session.IsConference)
        {
            if (!round.RankingsClosed && session.AllPresentRanked(round))
                dirty |= await CloseConferenceRoundAsync(session, sessionCode);
        }
        else
        {
            if (!round.RankingsClosed && session.AllPresentRanked(round))
            {
                round.RankingsClosed = true;
                dirty = true;
                await Clients.Group(sessionCode).SendAsync("AllRankingsSubmitted");
            }

            if (round.RankingsClosed && !round.RoundEnded && session.AllPresentGuessed(round))
            {
                round.RoundEnded = true;
                dirty = true;

                var sorted = session.Players.OrderByDescending(p => p.TotalScore).ToList();
                if (session.CurrentRound >= session.MaxRounds)
                {
                    session.Status = "Finished";
                    await Clients.Group(sessionCode).SendAsync("GameOver", sorted);
                }
                else
                {
                    await Clients.Group(sessionCode).SendAsync("LeaderboardUpdate", sorted);
                }
            }
        }

        if (dirty) await _repo.SaveSessionAsync(session);
    }

    /// Computes and broadcasts the Conference aggregate. Returns whether it
    /// mutated the session, so callers know if a save is owed.
    private async Task<bool> CloseConferenceRoundAsync(Session session, string sessionCode)
    {
        var round = session.Rounds.Last();
        if (round.Aggregate != null) return false; // already closed

        var aggregate = _consensusService.Compute(round, session.Players, session.HostPlayerId);
        // Report against who is actually in the room, not the historical roster.
        aggregate.PlayerCount = session.ConnectedCount;
        aggregate.IsFinalRound = session.CurrentRound >= session.MaxRounds;

        round.Aggregate = aggregate;
        round.RankingsClosed = true;
        round.RoundEnded = true;
        if (aggregate.IsFinalRound) session.Status = "Finished";

        await Clients.Group(sessionCode).SendAsync("RoundAggregate", aggregate);
        return true;
    }

    // ===================== Helpers =====================

    /// Resolves the caller's durable id from their current transport. Read from
    /// persisted session state rather than the in-memory map so it survives a
    /// process restart.
    private string? ResolvePlayerId(Session session) =>
        session.Players.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId)?.PlayerId;

    private bool IsHost(Session session) => ResolvePlayerId(session) == session.HostPlayerId;

    private static string GenerateSessionCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return new string(Enumerable.Repeat(chars, 6)
            .Select(s => s[Random.Shared.Next(s.Length)]).ToArray());
    }
}
