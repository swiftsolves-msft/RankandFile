using System.Text.Json;
using RankandFile.Core.Models;

namespace RankandFile.Core.Services;

public class CardGeneratorService
{
    private const int TotalCards = 5;
    private readonly List<Card> _safeCards;
    private readonly List<Card> _spicyCards;

    public CardGeneratorService()
    {
        var baseDir = AppContext.BaseDirectory;
        _safeCards = LoadCards(Path.Combine(baseDir, "nouns", "safe-nouns.json"), false);
        _spicyCards = LoadCards(Path.Combine(baseDir, "nouns", "spicy-nouns.json"), true);
    }

    private static readonly JsonSerializerOptions _jsonOpts = new() { PropertyNameCaseInsensitive = true };

    private static List<Card> LoadCards(string path, bool isSpicy)
    {
        var json = File.ReadAllText(path);
        var list = JsonSerializer.Deserialize<List<Card>>(json, _jsonOpts) ?? new();
        list.ForEach(c => c.IsSpicy = isSpicy);
        return list;
    }

    /// <summary>
    /// Deals a hand for one round. Pass a host-uploaded deck to play a different
    /// subject; omit it to use the built-in cybersecurity cards.
    /// </summary>
    public List<Card> GenerateRoundCards(CardDeck? deck = null)
    {
        var safePool = _safeCards;
        var spicyPool = _spicyCards;

        if (deck?.Cards is { Count: > 0 })
        {
            safePool = deck.Cards.Where(c => !c.IsSpicy).ToList();
            spicyPool = deck.Cards.Where(c => c.IsSpicy).ToList();
        }

        // Always produce exactly 5 cards: either 4 safe + 1 spicy (70%) or 3 safe + 2 spicy (30%)
        int spicyCount = Random.Shared.NextDouble() < 0.3 ? 2 : 1;

        // A custom deck is validated to hold enough of each on upload, but clamp
        // anyway so a thin pool degrades into a smaller hand rather than throwing
        // in the middle of a live session.
        spicyCount = Math.Min(spicyCount, spicyPool.Count);
        int safeCount = Math.Min(TotalCards - spicyCount, safePool.Count);

        var safe = safePool.OrderBy(_ => Random.Shared.Next()).Take(safeCount).ToList();
        var spicy = spicyPool.OrderBy(_ => Random.Shared.Next()).Take(spicyCount).ToList();

        return safe.Concat(spicy).OrderBy(_ => Random.Shared.Next()).ToList();
    }
}