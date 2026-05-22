using System.Net;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Azure.Cosmos;
using RankandFile.Core.Models;
using RankandFile.Core.Repositories;
using RankandFile.Core.Services;

namespace RankandFile.GameHub;

public class GameHub : Hub
{
    private const int MinPlayers = 6;
    private static readonly int[] AllowedMaxRounds = { 3, 5, 8 };

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

    public async Task CreateSession(string playerName)
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

    public async Task StartNewRound(string sessionCode, bool debugMode = false, int maxRounds = 5)
    {
        var session = await _repo.GetSessionAsync(sessionCode);
        if (session == null) return;

        var minPlayers = debugMode ? 2 : MinPlayers;
        if (session.Players.Count < minPlayers)
        {
            await Clients.Caller.SendAsync("Error", $"Need at least {minPlayers} players to start.");
            return;
        }

        // Lock in the round count on the very first round; ignore on subsequent calls.
        if (session.CurrentRound == 0)
            session.MaxRounds = AllowedMaxRounds.Contains(maxRounds) ? maxRounds : 5;

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

    public async Task SubmitRanking(string sessionCode, List<string> rankedNouns)
    {
        // Same ETag retry pattern as SubmitGuess — two players can submit rankings
        // simultaneously, causing last-write-wins to silently drop one submission.
        const int maxAttempts = 8;

        for (int attempt = 0; attempt < maxAttempts; attempt++)
        {
            var (session, etag) = await _repo.GetSessionWithETagAsync(sessionCode);
            if (session == null) return;

            var currentRound = session.Rounds.Last();

            // Idempotency guard — also triggers clean exit on a successful retry.
            if (currentRound.Rankings.ContainsKey(Context.ConnectionId))
                return;

            currentRound.Rankings[Context.ConnectionId] = rankedNouns;

            try
            {
                await _repo.SaveSessionAsync(session, etag);
            }
            catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.PreconditionFailed)
            {
                if (attempt < maxAttempts - 1) continue;
                throw;
            }

            if (currentRound.Rankings.Count == session.Players.Count)
                await Clients.Group(sessionCode).SendAsync("AllRankingsSubmitted");

            break;
        }
    }

    public async Task SubmitGuess(string sessionCode, string targetPlayerId, List<string> guessedRanking)
    {
        // Use optimistic concurrency (ETag) with a retry loop to handle the race condition
        // where two players submit their guesses simultaneously.  Without this, both reads
        // can happen before either write, so the last upsert silently discards the other
        // player's score and LeaderboardUpdate is never sent.
        const int maxAttempts = 8;

        for (int attempt = 0; attempt < maxAttempts; attempt++)
        {
            var (session, etag) = await _repo.GetSessionWithETagAsync(sessionCode);
            if (session == null) return;

            var currentRound = session.Rounds.Last();

            // Security: validate the guesser is actually paired with this target
            if (!currentRound.Pairings.TryGetValue(Context.ConnectionId, out var expectedTarget)
                || expectedTarget != targetPlayerId)
                return;

            if (!currentRound.Rankings.TryGetValue(targetPlayerId, out var actualRanking))
                return;

            // Prevent double submission — also guards against a successful retry being
            // re-entered (e.g. if GuessResult was sent but the caller retried anyway).
            if (currentRound.ScoresThisRound.ContainsKey(Context.ConnectionId))
                return;

            var (score, matchInfo) = _scoringService.CalculateScore(actualRanking, guessedRanking);

            currentRound.ScoresThisRound[Context.ConnectionId] = score;
            var guesser = session.Players.First(p => p.PlayerId == Context.ConnectionId);
            guesser.TotalScore += score;

            try
            {
                await _repo.SaveSessionAsync(session, etag);
            }
            catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.PreconditionFailed)
            {
                // Another player's write landed between our read and save.
                // Discard this in-memory copy and retry with a fresh read + new ETag.
                if (attempt < maxAttempts - 1) continue;
                throw; // give up after max attempts
            }

            // Save succeeded — send results to this player.
            var targetPlayer = session.Players.First(p => p.PlayerId == targetPlayerId);
            await Clients.Caller.SendAsync("GuessResult", new
            {
                TargetName = targetPlayer.Name,
                Score = score,
                Actual = actualRanking,
                Guessed = guessedRanking,
                MatchInfo = matchInfo
            });

            // Once everyone has submitted their guess, either end the round or end the game.
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

            break; // success — exit the retry loop
        }
    }

    private static string GenerateSessionCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return new string(Enumerable.Repeat(chars, 6)
            .Select(s => s[Random.Shared.Next(s.Length)]).ToArray());
    }
}
