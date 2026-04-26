namespace RankandFile.Core.Models;

public class Round
{
    public int RoundNum { get; set; }
    public List<Card> Cards { get; set; } = new();
    public Dictionary<string, List<string>> Rankings { get; set; } = new(); // playerId -> ordered nouns
    public Dictionary<string, string> Pairings { get; set; } = new(); // guesser -> target
    public List<string>? Triple { get; set; } // null if even count
    public Dictionary<string, double> ScoresThisRound { get; set; } = new();
}