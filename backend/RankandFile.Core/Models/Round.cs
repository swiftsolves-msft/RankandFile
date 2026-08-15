namespace RankandFile.Core.Models;

public class Round
{
    public int RoundNum { get; set; }
    public List<Card> Cards { get; set; } = new();
    public Dictionary<string, List<string>> Rankings { get; set; } = new(); // playerId -> ordered nouns
    public Dictionary<string, string> Pairings { get; set; } = new(); // guesser -> target (Ice Breaker only)
    public List<string>? Triple { get; set; } // null if even count, or in Conference mode
    public Dictionary<string, double> ScoresThisRound { get; set; } = new();

    // Conference mode only — the room-wide result computed when rankings close.
    // Non-null also acts as the idempotency guard so a round can only close once.
    public RoundAggregate? Aggregate { get; set; }
}
