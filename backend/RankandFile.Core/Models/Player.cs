namespace RankandFile.Core.Models;

public class Player
{
    /// <summary>
    /// Durable, client-supplied identity that survives a refresh or a dropped
    /// connection. This is what Rankings, Pairings and ScoresThisRound are keyed
    /// by — it used to be the SignalR ConnectionId, which meant any reconnect
    /// silently became a brand new player, orphaning their score and their
    /// submitted ranking while the old entry lingered forever.
    /// </summary>
    public string PlayerId { get; set; } = Guid.NewGuid().ToString();

    public string Name { get; set; } = string.Empty;
    public double TotalScore { get; set; } = 0;

    /// <summary>Current transport. Changes on every reconnect.</summary>
    public string ConnectionId { get; set; } = string.Empty;

    /// <summary>
    /// False while the player is away. Disconnected players are kept rather than
    /// removed so their score and ranking survive — but they are excluded from
    /// every round-completion count, so one dropped phone cannot stall the room.
    /// </summary>
    public bool IsConnected { get; set; } = true;

    /// <summary>Used to pick the longest-standing player when the host drops.</summary>
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}
