using System.Text;

namespace RankandFile.Core.Services;

/// <summary>
/// Authoritative server-side player-name safety check. Mirrors the client-side
/// list in frontend/lib/nameValidation.ts — keep the two roughly in sync. The
/// client check is for instant feedback; this one actually enforces the rule
/// so it cannot be bypassed by a modified client.
/// </summary>
public static class NameValidator
{
    public const string RejectedMessage =
        "Please use your real first and last name, this is used for matching you with others in each round and leaderboard";

    // Whole-token matches (after light leetspeak folding) so legitimate names
    // that merely contain these letters are not blocked.
    private static readonly HashSet<string> Banned = new(StringComparer.OrdinalIgnoreCase)
    {
        // profanity
        "fuck", "fuk", "fck", "shit", "bitch", "bastard", "asshole", "ass",
        "piss", "cunt", "prick", "wanker", "bollocks", "douche", "twat", "arsehole",
        // slurs (racial / sexual / ableist)
        "nigger", "nigga", "faggot", "fag", "retard", "spic", "chink", "kike",
        "tranny", "coon", "gook", "wetback", "paki",
        // sexual / explicit
        "porn", "penis", "vagina", "cum", "rape", "rapist", "pedo", "pedophile",
        "molest", "horny",
        // violence / sensitive
        "kill", "murder", "nazi", "hitler", "isis", "terrorist", "bomb", "bomber",
        "shooter", "genocide", "suicide", "slave",
        // impersonation / reserved
        "admin", "administrator", "host", "server", "system", "moderator", "root",
        "null", "undefined", "anonymous",
    };

    /// <summary>Returns true if the name is acceptable, false if it should be rejected.</summary>
    public static bool IsClean(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return false;

        var tokens = Normalize(name).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        foreach (var token in tokens)
        {
            if (Banned.Contains(token)) return false;
        }
        return true;
    }

    private static string Normalize(string raw)
    {
        var sb = new StringBuilder(raw.Length);
        foreach (var ch in raw.ToLowerInvariant())
        {
            var mapped = ch switch
            {
                '0' => 'o',
                '1' => 'i',
                '3' => 'e',
                '4' => 'a',
                '5' => 's',
                '7' => 't',
                '@' => 'a',
                '$' => 's',
                _ => ch,
            };
            // Non-letters become spaces so we tokenise cleanly.
            sb.Append(char.IsLetter(mapped) ? mapped : ' ');
        }
        return sb.ToString();
    }
}
