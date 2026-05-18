namespace RankandFile.Core.Services;

public class ScoringService
{
    // Returns total score and per-card match detail.
    // matchInfo: noun → "exact" | "near" | "miss"
    public (int Score, Dictionary<string, string> MatchInfo) CalculateScore(
        List<string> actualRanking, List<string> guessedRanking)
    {
        var matchInfo = new Dictionary<string, string>();
        if (actualRanking.Count == 0 || actualRanking.Count != guessedRanking.Count)
            return (0, matchInfo);

        int score = 0;
        for (int i = 0; i < actualRanking.Count; i++)
        {
            string noun = actualRanking[i];
            int guessedPos = guessedRanking.IndexOf(noun);
            string match;
            if (guessedPos == i)
            {
                match = "exact";
                score += 3;
            }
            else if (Math.Abs(guessedPos - i) == 1)
            {
                match = "near";
                score += 1;
            }
            else
            {
                match = "miss";
            }
            matchInfo[noun] = match;
        }
        return (score, matchInfo);
    }
}
