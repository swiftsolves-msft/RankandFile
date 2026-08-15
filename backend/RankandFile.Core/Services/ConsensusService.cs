using RankandFile.Core.Models;

namespace RankandFile.Core.Services;

/// <summary>
/// Conference mode's answer aggregator. Turns every player's ranking for a round
/// into the room's collective verdict plus the per-player and outlier stats the
/// end-of-round dashboards render.
///
/// Deliberately produces no points and no winner: ranking players by how closely
/// they match the consensus would reward conformity and punish the honest
/// minority opinions that make the discussion worth having. Alignment here is
/// descriptive, never a score.
/// </summary>
public class ConsensusService
{
    public RoundAggregate Compute(Round round, List<Player> players, string hostPlayerId)
    {
        var nouns = round.Cards.Select(c => c.Noun).ToList();
        var isSpicy = round.Cards.ToDictionary(c => c.Noun, c => c.IsSpicy);
        int n = nouns.Count;

        var agg = new RoundAggregate
        {
            RoundNum = round.RoundNum,
            PlayerCount = players.Count,
        };
        if (n == 0) return agg;

        // Only count rankings that are a complete, duplicate-free permutation of
        // this round's cards. Anything else (a stale client, a partial submit) is
        // dropped rather than allowed to skew the consensus.
        var valid = round.Rankings
            .Where(kv => kv.Value.Count == n
                         && kv.Value.Distinct().Count() == n
                         && kv.Value.All(nouns.Contains))
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        agg.SubmittedCount = valid.Count;
        if (valid.Count == 0) return agg;

        // positions[noun] = every 1-based position players gave that card
        var positions = nouns.ToDictionary(x => x, _ => new List<int>());
        foreach (var ranking in valid.Values)
            for (int i = 0; i < ranking.Count; i++)
                positions[ranking[i]].Add(i + 1);

        // Consensus order = ascending mean rank. Noun breaks ties so the ordering
        // is deterministic rather than dependent on dictionary enumeration.
        var ordered = nouns
            .Select(noun => new { Noun = noun, Mean = positions[noun].Average() })
            .OrderBy(x => x.Mean)
            .ThenBy(x => x.Noun, StringComparer.Ordinal)
            .ToList();

        for (int i = 0; i < ordered.Count; i++)
        {
            var noun = ordered[i].Noun;
            var given = positions[noun];
            var distribution = new int[n];
            foreach (var p in given) distribution[p - 1]++;

            double mean = ordered[i].Mean;
            double variance = given.Sum(p => (p - mean) * (p - mean)) / given.Count;

            agg.Consensus.Add(new ConsensusCard
            {
                Noun = noun,
                IsSpicy = isSpicy.TryGetValue(noun, out var s) && s,
                Position = i + 1,
                MeanRank = Math.Round(mean, 2),
                Distribution = distribution.ToList(),
                Spread = Math.Round(Math.Sqrt(variance), 2),
            });
        }

        var consensusOrder = agg.Consensus.Select(c => c.Noun).ToList();

        valid.TryGetValue(hostPlayerId, out var hostRanking);
        agg.HasHostRanking = hostRanking != null;
        agg.HostRanking = hostRanking ?? new List<string>();

        foreach (var (playerId, ranking) in valid)
        {
            agg.Alignments.Add(new PlayerAlignment
            {
                PlayerId = playerId,
                Name = players.FirstOrDefault(p => p.PlayerId == playerId)?.Name ?? "(unknown)",
                ToRoom = Alignment(ranking, consensusOrder),
                ToHost = hostRanking == null ? 0 : Alignment(ranking, hostRanking),
            });
        }

        agg.Alignments = agg.Alignments.OrderByDescending(a => a.ToRoom).ToList();
        agg.RoomAverageAlignment = Math.Round(agg.Alignments.Average(a => a.ToRoom), 1);
        agg.HostToRoom = agg.Alignments.FirstOrDefault(a => a.PlayerId == hostPlayerId)?.ToRoom ?? 0;

        // Up to 3 furthest-from-consensus players. The host is excluded — the host
        // gets their own panel, and "the presenter is the weirdo" isn't the
        // conversation this is trying to start.
        agg.Outliers = agg.Alignments
            .Where(a => a.PlayerId != hostPlayerId)
            .OrderBy(a => a.ToRoom)
            .Take(3)
            .Select(a => BuildOutlier(a, valid[a.PlayerId], consensusOrder))
            .ToList();

        agg.MostDivisiveNoun = agg.Consensus
            .OrderByDescending(c => c.Spread)
            .ThenBy(c => c.Noun, StringComparer.Ordinal)
            .First().Noun;

        return agg;
    }

    /// <summary>
    /// Agreement between two rankings on a 0-100 scale, from Spearman's rank
    /// correlation: rho = 1 - 6*sum(d²) / (n(n²-1)), rescaled from [-1, 1] to
    /// [0, 100]. Identical orderings score 100; an exact reversal scores 0.
    ///
    /// Spearman rather than the simpler footrule (sum of |d|) because footrule
    /// over a permutation is always even — displacements must balance — which for
    /// 5 cards leaves just 7 reachable scores and stacks a whole room into a
    /// handful of ties. Spearman yields 21 values in clean 5-point steps over the
    /// same 120 permutations, and squaring the differences separates genuine
    /// outliers more sharply: burying one card four slots off now costs more than
    /// being one slot off on four cards.
    /// </summary>
    public static double Alignment(List<string> a, List<string> b)
    {
        int n = a.Count;
        if (n == 0 || n != b.Count) return 0;
        if (n == 1) return 100; // n(n²-1) == 0 — no spread to correlate against

        double sumSquaredDiff = 0;
        for (int i = 0; i < n; i++)
        {
            int j = b.IndexOf(a[i]);
            if (j < 0) return 0; // different card sets — not comparable
            double d = i - j;
            sumSquaredDiff += d * d;
        }

        double rho = 1.0 - (6.0 * sumSquaredDiff) / (n * ((double)n * n - 1));
        return Math.Round((rho + 1.0) / 2.0 * 100, 1);
    }

    /// Finds the single card this player placed furthest from the room's position.
    private static Outlier BuildOutlier(PlayerAlignment a, List<string> ranking, List<string> consensus)
    {
        string noun = ranking[0];
        int worstDelta = -1, theirPosition = 1, roomPosition = 1;

        for (int i = 0; i < ranking.Count; i++)
        {
            int j = consensus.IndexOf(ranking[i]);
            if (j < 0) continue;
            int delta = Math.Abs(i - j);
            if (delta > worstDelta)
            {
                worstDelta = delta;
                noun = ranking[i];
                theirPosition = i + 1;
                roomPosition = j + 1;
            }
        }

        return new Outlier
        {
            PlayerId = a.PlayerId,
            Name = a.Name,
            ToRoom = a.ToRoom,
            Noun = noun,
            TheirPosition = theirPosition,
            RoomPosition = roomPosition,
        };
    }
}
