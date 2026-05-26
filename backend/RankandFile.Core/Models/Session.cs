namespace RankandFile.Core.Models;

public class Session
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SessionCode { get; set; } = string.Empty;
    public string HostPlayerId { get; set; } = string.Empty;
    public string Status { get; set; } = "Lobby"; // Lobby, Playing, Finished
    public List<Player> Players { get; set; } = new();
    public int CurrentRound { get; set; } = 0;
    public List<Round> Rounds { get; set; } = new();
    // Stored as List for Cosmos DB JSON round-trip compatibility.
    // Use a local HashSet when doing lookups in PairingService.
    public List<string> PreviousPairs { get; set; } = new(); // "minId-maxId"
    public int MaxRounds { get; set; } = 2;
    public string GameMode { get; set; } = "normal"; // "normal" | "meme"
}