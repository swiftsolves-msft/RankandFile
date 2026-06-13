// Client-side player-name safety check.
//
// Mirrors the authoritative server-side guard in
// backend/RankandFile.Core/Services/NameValidator.cs — keep the two banned
// lists roughly in sync. The client check exists purely for instant red-text
// feedback; the server check is what actually enforces the rule.

export const NAME_REJECTED_MESSAGE =
  'Please use your real first and last name, this is used for matching you with others in each round and leaderboard';

// Words that cause a name to be rejected. Matched as whole tokens (after
// light leetspeak normalisation) so legitimate names that merely *contain*
// these letters — "Cassidy", "Killian", "Saskia" — are NOT blocked.
//
// Intentionally omits ambiguous real-name collisions (e.g. "Dick" for
// Richard) and leans on whole-token matching to keep false positives low.
// This list is easy to extend — add a lowercase word and redeploy.
const BANNED_WORDS = new Set<string>([
  // profanity
  'fuck', 'fuk', 'fck', 'shit', 'bitch', 'bastard', 'asshole', 'ass',
  'piss', 'cunt', 'prick', 'wanker', 'bollocks', 'douche', 'twat', 'arsehole',
  // slurs (racial / sexual / ableist)
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'spic', 'chink', 'kike',
  'tranny', 'coon', 'gook', 'wetback', 'paki',
  // sexual / explicit
  'porn', 'penis', 'vagina', 'cum', 'rape', 'rapist', 'pedo', 'pedophile',
  'molest', 'horny',
  // violence / sensitive
  'kill', 'murder', 'nazi', 'hitler', 'isis', 'terrorist', 'bomb', 'bomber',
  'shooter', 'genocide', 'suicide', 'slave',
  // impersonation / reserved
  'admin', 'administrator', 'host', 'server', 'system', 'moderator', 'root',
  'null', 'undefined', 'anonymous',
]);

// Lightweight leetspeak folding so "sh1t" / "f@ck" / "n4zi" are caught.
function normalize(raw: string): string {
  const lowered = raw.toLowerCase();
  let out = '';
  for (const ch of lowered) {
    const mapped =
      ch === '0' ? 'o' :
      ch === '1' ? 'i' :
      ch === '3' ? 'e' :
      ch === '4' ? 'a' :
      ch === '5' ? 's' :
      ch === '7' ? 't' :
      ch === '@' ? 'a' :
      ch === '$' ? 's' :
      ch;
    // Replace anything that isn't a letter with a space so we tokenise cleanly.
    out += /[a-z]/.test(mapped) ? mapped : ' ';
  }
  return out;
}

/**
 * Returns an error message string if the name should be rejected, or null if
 * the name is acceptable.
 */
export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return NAME_REJECTED_MESSAGE;

  const tokens = normalize(trimmed).split(' ').filter(Boolean);
  for (const token of tokens) {
    if (BANNED_WORDS.has(token)) return NAME_REJECTED_MESSAGE;
  }
  return null;
}
