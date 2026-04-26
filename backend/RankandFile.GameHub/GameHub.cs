using Microsoft.AspNetCore.SignalR;
using RankandFile.Core.Models;
using RankandFile.Core.Repositories;
using RankandFile.Core.Services;

namespace RankandFile.GameHub;

public class GameHub : Hub
{
    private const int MaxRounds = 5;
    private const int MinPlayers = 6;

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

    public async Task StartNewRound(string sessionCode)
    {
        var session = await _repo.GetSessionAsync(sessionCode);
        if (session == null) return;

        if (session.Players.Count < MinPlayers)
        {
            await Clients.Caller.SendAsync("Error", $"Need at least {MinPlayers} players to start.");
            return;
        }

        if (session.CurrentRound >= MaxRounds)
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
        var session = await _repo.GetSessionAsync(sessionCode);
        if (session == null) return;

        var currentRound = session.Rounds.Last();
        currentRound.Rankings[Context.ConnectionId] = rankedNouns;

        if (currentRound.Rankings.Count == session.Players.Count)
        {
            await Clients.Group(sessionCode).SendAsync("AllRankingsSubmitted");
        }

        await _repo.SaveSessionAsync(session);
    }

    public async Task SubmitGuess(string sessionCode, string targetPlayerId, List<string> guessedRanking)
    {
        var session = await _repo.GetSessionAsync(sessionCode);
        if (session == null) return;

        var currentRound = session.Rounds.Last();

        // Security: validate the guesser is actually paired with this target
        if (!currentRound.Pairings.TryGetValue(Context.ConnectionId, out var expectedTarget)
            || expectedTarget != targetPlayerId)
        {
            return;
        }

        if (!currentRound.Rankings.TryGetValue(targetPlayerId, out var actualRanking))
            return;

        // Prevent double submission
        if (currentRound.ScoresThisRound.ContainsKey(Context.ConnectionId))
            return;

        var score = _scoringService.CalculateScore(actualRanking, guessedRanking);

        currentRound.ScoresThisRound[Context.ConnectionId] = score;

        var guesser = session.Players.First(p => p.PlayerId == Context.ConnectionId);
        guesser.TotalScore += score;

        var targetPlayer = session.Players.First(p => p.PlayerId == targetPlayerId);

        await _repo.SaveSessionAsync(session);

        // Send result only to the guesser
        await Clients.Caller.SendAsync("GuessResult", new
        {
            TargetName = targetPlayer.Name,
            Score = score,
            Actual = actualRanking,
            Guessed = guessedRanking
        });

        // Only broadcast leaderboard once everyone has submitted their guess
        if (currentRound.ScoresThisRound.Count == session.Players.Count)
        {
            await Clients.Group(sessionCode).SendAsync("LeaderboardUpdate",
                session.Players.OrderByDescending(p => p.TotalScore).ToList());
        }
    }

    private static string GenerateSessionCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return new string(Enumerable.Repeat(chars, 6)
            .Select(s => s[Random.Shared.Next(s.Length)]).ToArray());
    }
}
