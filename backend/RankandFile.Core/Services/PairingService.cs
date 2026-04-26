using RankandFile.Core.Models;

namespace RankandFile.Core.Services;

public class PairingService
{
    public (Dictionary<string, string> pairings, List<string>? triple) CreatePairings(
        List<Player> players,
        HashSet<string> previousPairs)
    {
        var playerIds = players.Select(p => p.PlayerId).ToList();
        var n = playerIds.Count;
        var pairings = new Dictionary<string, string>();
        List<string>? triple = null;

        // Shuffle for randomness
        var shuffled = playerIds.OrderBy(_ => Guid.NewGuid()).ToList();

        if (n % 2 == 0)
        {
            AssignPairs(shuffled, pairings, previousPairs);
        }
        else
        {
            // Find the best triple (fewest prior connections among the three edges)
            triple = GetBestTriple(shuffled, previousPairs);
            var a = triple[0];
            var b = triple[1];
            var c = triple[2];

            pairings[a] = b;
            pairings[b] = c;
            pairings[c] = a;

            AddPair(previousPairs, a, b);
            AddPair(previousPairs, b, c);
            AddPair(previousPairs, c, a);

            // Remaining even players
            var remaining = shuffled.Except(triple).ToList();
            AssignPairs(remaining, pairings, previousPairs);
        }

        return (pairings, triple);
    }

    /// <summary>
    /// Greedy assignment that tries to avoid repeat pairings by swapping with a later index
    /// when a repeat is detected. Good enough for ≤60 players over 5 rounds.
    /// </summary>
    private static void AssignPairs(
        List<string> ids,
        Dictionary<string, string> pairings,
        HashSet<string> previousPairs)
    {
        var work = new List<string>(ids);

        for (int i = 0; i < work.Count - 1; i += 2)
        {
            // Try to find a j > i+1 to swap work[i+1] with so that (work[i], work[j]) is fresh
            if (IsPriorPair(previousPairs, work[i], work[i + 1]))
            {
                bool swapped = false;
                for (int j = i + 2; j < work.Count; j++)
                {
                    if (!IsPriorPair(previousPairs, work[i], work[j]) &&
                        !IsPriorPair(previousPairs, work[i + 1], work[j + 1 < work.Count ? j + 1 : i + 1]))
                    {
                        (work[i + 1], work[j]) = (work[j], work[i + 1]);
                        swapped = true;
                        break;
                    }
                }
                // If no swap found, accept the repeat rather than failing
                _ = swapped;
            }

            var p1 = work[i];
            var p2 = work[i + 1];
            pairings[p1] = p2;
            pairings[p2] = p1;
            AddPair(previousPairs, p1, p2);
        }
    }

    /// <summary>
    /// Picks the best triple from the front of the shuffled list: iterates all
    /// combinations of the first min(n, 8) players and picks the triplet with the
    /// fewest prior pair-edges (a→b, b→c, c→a). Falls back to first three on tie.
    /// </summary>
    private static List<string> GetBestTriple(List<string> ids, HashSet<string> previousPairs)
    {
        int search = Math.Min(ids.Count, 8);
        List<string>? bestTriple = null;
        int bestOverlap = int.MaxValue;

        for (int a = 0; a < search - 2; a++)
        {
            for (int b = a + 1; b < search - 1; b++)
            {
                for (int c = b + 1; c < search; c++)
                {
                    int overlap =
                        (IsPriorPair(previousPairs, ids[a], ids[b]) ? 1 : 0) +
                        (IsPriorPair(previousPairs, ids[b], ids[c]) ? 1 : 0) +
                        (IsPriorPair(previousPairs, ids[c], ids[a]) ? 1 : 0);

                    if (overlap < bestOverlap)
                    {
                        bestOverlap = overlap;
                        bestTriple = new List<string> { ids[a], ids[b], ids[c] };
                        if (overlap == 0) goto done; // can't do better
                    }
                }
            }
        }
        done:
        return bestTriple ?? ids.Take(3).ToList();
    }

    private static bool IsPriorPair(HashSet<string> previousPairs, string a, string b)
    {
        var key = string.Compare(a, b, StringComparison.Ordinal) < 0 ? $"{a}-{b}" : $"{b}-{a}";
        return previousPairs.Contains(key);
    }

    private static void AddPair(HashSet<string> previousPairs, string a, string b)
    {
        var key = string.Compare(a, b, StringComparison.Ordinal) < 0 ? $"{a}-{b}" : $"{b}-{a}";
        previousPairs.Add(key);
    }
}
