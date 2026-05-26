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

    private readonly SessionRepository _repo;
    private readonly CardGeneratorService _cardGen;
    private readonly PairingService _pairingService;
    private readonly ScoringService _scoringService;

    public GameHub(SessionRepository repo, CardGeneratorService cardGen,
                   PairingService pairingService, ScoringService scoringService)
    {
        _repo = repo;
        _cardGen = cardGen;
        _pairingService = pairingService;
        _scoringService = scoringService;
    }

    public async Task JoinSession(string sessionCode, string playerName)
    {
        try
        {
            var session = await _repo.GetSessionAsync(sessionCode);
            if (session == null)
            {
                await Clients.Caller.SendAsync("Error", $"Session '{sessionCode}' not found.");
                return;
            }

            var player = new Player { Name = playerName, PlayerId = Context.ConnectionId };
            if (!session.Players.Any(p => p.PlayerId == player.PlayerId))
                session.Players.Add(player);

            await Groups.AddToGroupAsync(Context.ConnectionId, sessionCode);
            await _repo.SaveSessionAsync(session);

            await Clients.Group(sessionCode).SendAsync("SessionUpdated", session);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Failed to join session: {ex.Message}");
        }
    }

    public async Task CreateSession(string playerName)
    {
        try
        {
            // Retry until we get an unused code (collision protection)
            string sessionCode;
            do
            {
                sessionCode = GenerateSessionCode();
            } while (await _repo.GetSessionAsync(sessionCode) != null);

            var session = new Session
            {
                SessionCode = sessionCode,
                HostPlayerId = Context.ConnectionId,
            };

            var player = new Player { Name = playerName, PlayerId = Context.ConnectionId };
            session.Players.Add(player);

            await Groups.AddToGroupAsync(Context.ConnectionId, sessionCode);
            await _repo.SaveSessionAsync(session);

            await Clients.Group(sessionCode).SendAsync("SessionUpdated", session);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", $"Failed to create session: {ex.Message}");
        }
    }

    public async Task StartNewRound(string sessionCode, int maxRounds = 2, string gameMode = "normal")
    {
        try
        {
            var session = await _repo.GetSessionAsync(sessionCode);
            if (session == null)
            {
                await Clients.Caller.SendAsync("Error", "Session not found.");
                return;
            }

            if (session.Players.Count < MinPlayers)
            {
                await Clients.Caller.SendAsync("Error", $"Need at least {MinPlayers} players to start.");
                return;
            }

            // Lock in the round count on the very first round; ignore on subsequent calls.
            if (session.CurrentRound == 0)
            {
                session.MaxRounds = AllowedMaxRounds.Contains(maxRounds) ? maxRounds : 2;
                session.GameMode = gameMode == "meme" ? "meme" : "normal";
                // Broadcast the updated session so every client immediately sees the
                // correct MaxRounds and GameMode values before the first RoundStarted fires.
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

            var lookup = new HashSet<string>(session.PreviousPairs);
            var (pairings, triple) = _pairingService.CreatePairings(session.Players, lookup);
            round.Pairings = pairings;
            round.Triple = triple;

            // Persist updated previous pairs back to the list
            session.PreviousPairs = lookup.ToList();

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

            if (session.Rounds.Count == 0)
            {
                await Clients.Caller.SendAsync("Error", "No active round found for ranking submission.");
                return;
            }

            var currentRound = session.Rounds.Last();

            // Idempotency guard — handles double-submit (manual + auto-submit at t=0).
            if (currentRound.Rankings.ContainsKey(Context.ConnectionId))
                return;

            currentRound.Rankings[Context.ConnectionId] = rankedNouns;
            await _repo.SaveSessionAsync(session);

            if (currentRound.Rankings.Count == session.Players.Count)
                await Clients.Group(sessionCode).SendAsync("AllRankingsSubmitted");
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

            if (session.Rounds.Count == 0)
            {
                await Clients.Caller.SendAsync("Error", "No active round found for guess submission.");
                return;
            }

            var currentRound = session.Rounds.Last();

            // Security: validate the guesser is actually paired with this target.
            if (!currentRound.Pairings.TryGetValue(Context.ConnectionId, out var expectedTarget)
                || expectedTarget != targetPlayerId)
            {
                await Clients.Caller.SendAsync("Error",
                    $"Pairing mismatch: {Context.ConnectionId} is not paired with {targetPlayerId}. Expected target: {expectedTarget ?? "(none)"}");
                return;
            }

            if (!currentRound.Rankings.TryGetValue(targetPlayerId, out var actualRanking))
            {
                await Clients.Caller.SendAsync("Error",
                    $"Target player {targetPlayerId} has not submitted a ranking yet.");
                return;
            }

            // Idempotency guard — handles double-submit (manual + auto-submit at t=0).
            if (currentRound.ScoresThisRound.ContainsKey(Context.ConnectionId))
                return;

            var (score, matchInfo) = _scoringService.CalculateScore(actualRanking, guessedRanking);

            currentRound.ScoresThisRound[Context.ConnectionId] = score;

            // Update the guesser's cumulative score (defensive null-check).
            var guesser = session.Players.FirstOrDefault(p => p.PlayerId == Context.ConnectionId);
            if (guesser != null)
                guesser.TotalScore += score;

            await _repo.SaveSessionAsync(session);

            // Send the per-player result notification (cosmetic — skip gracefully if
            // the target player record is somehow missing; game progression continues).
            var targetPlayer = session.Players.FirstOrDefault(p => p.PlayerId == targetPlayerId);
            if (targetPlayer != null)
            {
                await Clients.Caller.SendAsync("GuessResult", new
                {
                    TargetName = targetPlayer.Name,
                    Score = score,
                    Actual = actualRanking,
                    Guessed = guessedRanking,
                    MatchInfo = matchInfo
                });
            }

            // Once everyone has submitted, end the round or the game.
            // This runs regardless of whether GuessResult could be sent above.
            if (currentRound.ScoresThisRound.Count == session.Players.Count)
            {
                var sorted = session.Players.OrderByDescending(p => p.TotalScore).ToList();

                if (session.CurrentRound >= session.MaxRounds)
                {
                    session.Status = "Finished";
                    await _repo.SaveSessionAsync(session);
                    await Clients.Group(sessionCode).SendAsync("GameOver", sorted);
                }
                else
                {
                    await Clients.Group(sessionCode).SendAsync("LeaderboardUpdate", sorted);
                }
            }
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

    private static string GenerateSessionCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return new string(Enumerable.Repeat(chars, 6)
            .Select(s => s[Random.Shared.Next(s.Length)]).ToArray());
    }
}
