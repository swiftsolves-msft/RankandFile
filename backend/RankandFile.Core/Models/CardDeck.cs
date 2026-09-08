namespace RankandFile.Core.Models;

/// <summary>
/// A named set of cards a host can upload in place of the built-in cybersecurity
/// deck, so the game can be run for any subject — cloud, AI, business strategy.
/// </summary>
public class CardDeck
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<Card> Cards { get; set; } = new();
}
