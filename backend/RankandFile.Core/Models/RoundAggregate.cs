namespace RankandFile.Core.Models;

/// <summary>
/// One card's standing in the room's collective ranking for a Conference round.
/// </summary>
public class ConsensusCard
{
    public string Noun { get; set; } = string.Empty;
    public bool IsSpicy { get; set; }

    /// 1-based position in the room's consensus ordering.
    public int Position { get; set; }

    /// Average 1-based position this card was given across all submitted rankings.
    /// This (Borda / mean rank) is what orders the consensus — a modal *exact*
    /// ordering is useless here, since 5 cards yield 120 permutations and a room
    /// of any size will produce almost entirely unique orderings.
    public double MeanRank { get; set; }

    /// Votes per position; index 0 = position 1. Drives the distribution strip.
    public List<int> Distribution { get; set; } = new();

    /// Standard deviation of the positions given. Higher = the room was split.
    public double Spread { get; set; }
}

/// <summary>How closely one player tracked the room, and the host.</summary>
public class PlayerAlignment
{
    public string PlayerId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public double ToRoom { get; set; } // 0-100
    public double ToHost { get; set; } // 0-100
}

/// <summary>
/// A player who landed furthest from consensus, plus the single card they
/// diverged on most — the discussion prompt.
/// </summary>
public class Outlier
{
    public string PlayerId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public double ToRoom { get; set; }
    public string Noun { get; set; } = string.Empty;
    public int TheirPosition { get; set; }
    public int RoomPosition { get; set; }
}

/// <summary>
/// Everything the end-of-round dashboards need, computed once and broadcast to
/// the whole room. The host board and each player's personal report are two
/// projections of this same payload.
/// </summary>
public class RoundAggregate
{
    public int RoundNum { get; set; }
    public int SubmittedCount { get; set; }
    public int PlayerCount { get; set; }

    public List<ConsensusCard> Consensus { get; set; } = new();
    public List<PlayerAlignment> Alignments { get; set; } = new();
    public List<Outlier> Outliers { get; set; } = new();

    public double RoomAverageAlignment { get; set; }

    public List<string> HostRanking { get; set; } = new();
    public bool HasHostRanking { get; set; }
    public double HostToRoom { get; set; }

    /// Card with the widest spread of positions — the room's biggest argument.
    public string? MostDivisiveNoun { get; set; }

    /// True when this was the last round, so clients show the wrap-up instead of
    /// a "start next round" control.
    public bool IsFinalRound { get; set; }
}
