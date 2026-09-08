using RankandFile.Core.Models;

namespace RankandFile.Core.Services;

public class DeckValidationResult
{
    public List<string> Errors { get; } = new();
    public bool IsValid => Errors.Count == 0;
    public int SafeCount { get; set; }
    public int SpicyCount { get; set; }
}

/// <summary>
/// Canonical rules for an uploaded deck.
///
/// The browser runs the same checks so an author gets instant feedback, but this
/// is the copy that actually decides: the client is not a trust boundary, and a
/// deck that slipped through malformed would not fail at upload — it would fail
/// mid-round, in front of a room.
/// </summary>
public static class DeckValidator
{
    public const int MaxCards = 100;
    public const int MaxNameLength = 80;
    public const int MaxDescriptionLength = 200;
    public const int MaxNounLength = 60;
    public const int MaxTooltipLength = 300;

    // A round deals 4 safe + 1 spicy, or 3 safe + 2 spicy. Anything thinner than
    // this cannot fill a hand, so it is rejected at upload rather than throwing
    // partway through a session.
    public const int MinSafeCards = 4;
    public const int MinSpicyCards = 2;

    public static DeckValidationResult Validate(CardDeck? deck)
    {
        var result = new DeckValidationResult();

        if (deck == null)
        {
            result.Errors.Add("Deck is empty or could not be read.");
            return result;
        }

        if (string.IsNullOrWhiteSpace(deck.Name))
            result.Errors.Add("\"name\" is required and cannot be blank.");
        else if (deck.Name.Length > MaxNameLength)
            result.Errors.Add($"\"name\" must be {MaxNameLength} characters or fewer.");

        if (deck.Description != null && deck.Description.Length > MaxDescriptionLength)
            result.Errors.Add($"\"description\" must be {MaxDescriptionLength} characters or fewer.");

        if (deck.Cards == null || deck.Cards.Count == 0)
        {
            result.Errors.Add("\"cards\" is required and must contain at least one card.");
            return result;
        }

        if (deck.Cards.Count > MaxCards)
            result.Errors.Add($"Deck has {deck.Cards.Count} cards; the maximum is {MaxCards}.");

        var seenNouns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (int i = 0; i < deck.Cards.Count; i++)
        {
            var card = deck.Cards[i];
            var where = $"Card {i + 1}";

            if (card == null)
            {
                result.Errors.Add($"{where} is empty.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(card.Noun))
                result.Errors.Add($"{where}: \"noun\" is required.");
            else
            {
                if (card.Noun.Length > MaxNounLength)
                    result.Errors.Add($"{where} (\"{Trim(card.Noun)}\"): \"noun\" must be {MaxNounLength} characters or fewer.");

                // Nouns key the rankings, so a duplicate would let the same card
                // be dealt twice into one hand and corrupt that round's scoring.
                if (!seenNouns.Add(card.Noun.Trim()))
                    result.Errors.Add($"{where}: duplicate noun \"{Trim(card.Noun)}\". Every noun must be unique.");
            }

            if (string.IsNullOrWhiteSpace(card.Tooltip))
                result.Errors.Add($"{where} (\"{Trim(card.Noun)}\"): \"tooltip\" is required.");
            else if (card.Tooltip.Length > MaxTooltipLength)
                result.Errors.Add($"{where} (\"{Trim(card.Noun)}\"): \"tooltip\" must be {MaxTooltipLength} characters or fewer.");

            if (string.IsNullOrWhiteSpace(card.TooltipMeme))
                result.Errors.Add($"{where} (\"{Trim(card.Noun)}\"): \"tooltipMeme\" is required. It is shown when the host picks Meme card mode.");
            else if (card.TooltipMeme.Length > MaxTooltipLength)
                result.Errors.Add($"{where} (\"{Trim(card.Noun)}\"): \"tooltipMeme\" must be {MaxTooltipLength} characters or fewer.");

            if (string.IsNullOrWhiteSpace(card.Category))
                result.Errors.Add($"{where} (\"{Trim(card.Noun)}\"): \"category\" is required.");
        }

        result.SafeCount = deck.Cards.Count(c => c != null && !c.IsSpicy);
        result.SpicyCount = deck.Cards.Count(c => c != null && c.IsSpicy);

        if (result.SafeCount < MinSafeCards)
            result.Errors.Add($"Deck needs at least {MinSafeCards} cards with \"isSpicy\": false (found {result.SafeCount}).");

        if (result.SpicyCount < MinSpicyCards)
            result.Errors.Add($"Deck needs at least {MinSpicyCards} cards with \"isSpicy\": true (found {result.SpicyCount}).");

        return result;
    }

    private static string Trim(string? value) =>
        string.IsNullOrEmpty(value) ? "?" : value.Length <= 30 ? value : value[..30] + "...";
}
