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

    // How the cards read: "normal" | "meme".
    // Previously called GameMode — renamed when the Ice Breaker / Conference axis
    // took that name. Sessions are ephemeral so no data migration is needed; a
    // pre-rename document simply loses its meme setting and defaults to normal.
    public string CardMode { get; set; } = "normal";

    // What a round actually does: "icebreaker" (pair up and guess a partner's
    // ranking) | "conference" (no pairing — aggregate the whole room's rankings).
    // Always compare against "conference" rather than "icebreaker": a pre-rename
    // document carries gameMode "normal"/"meme" here, and falling through to
    // icebreaker is the correct, safe default.
    public string GameMode { get; set; } = "icebreaker";

    public bool IsConference => GameMode == "conference";
}
