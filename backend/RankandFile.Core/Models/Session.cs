using System.Text.Json.Serialization;

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

    /// <summary>
    /// Everyone currently present. Every round-completion check counts these and
    /// never Players.Count — otherwise a single dropped connection leaves a total
    /// that can never be reached and the round hangs for the whole room.
    /// </summary>
    [JsonIgnore]
    public List<Player> ConnectedPlayers => Players.Where(p => p.IsConnected).ToList();

    [JsonIgnore]
    public int ConnectedCount => Players.Count(p => p.IsConnected);

    /// <summary>
    /// Rankings in from people still present. Submissions by someone who has
    /// since left are excluded deliberately: they would hold the numerator above
    /// a denominator that already shrank, so the round would never settle.
    /// </summary>
    public int SubmittedRankingCount(Round round) =>
        Players.Count(p => p.IsConnected && round.Rankings.ContainsKey(p.PlayerId));

    public int SubmittedGuessCount(Round round) =>
        Players.Count(p => p.IsConnected && round.ScoresThisRound.ContainsKey(p.PlayerId));

    /// <summary>True once everyone present has ranked — the trigger to close early.</summary>
    public bool AllPresentRanked(Round round) =>
        ConnectedCount > 0 && SubmittedRankingCount(round) >= ConnectedCount;

    public bool AllPresentGuessed(Round round) =>
        ConnectedCount > 0 && SubmittedGuessCount(round) >= ConnectedCount;

    /// <summary>
    /// Hands the host role to the longest-standing connected player when the
    /// current host is absent, so a session is never left with nobody able to
    /// advance it. Returns whether the host changed.
    /// </summary>
    public bool PromoteHostIfNeeded()
    {
        var host = Players.FirstOrDefault(p => p.PlayerId == HostPlayerId);
        if (host != null && host.IsConnected) return false;

        var successor = Players
            .Where(p => p.IsConnected)
            .OrderBy(p => p.JoinedAt)
            .FirstOrDefault();

        if (successor == null || successor.PlayerId == HostPlayerId) return false;

        HostPlayerId = successor.PlayerId;
        return true;
    }
}
