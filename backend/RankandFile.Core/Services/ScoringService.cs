namespace RankandFile.Core.Services;

public class ScoringService
{
    public double CalculateScore(List<string> actualRanking, List<string> guessedRanking)
    {
        if (actualRanking.Count == 0 || actualRanking.Count != guessedRanking.Count)
            return 0;

        int count = actualRanking.Count;
        double score = 0;
        bool perfect = true;

        for (int i = 0; i < count; i++)
        {
            string guessedCard = guessedRanking[i];

            // Exact match
            if (actualRanking[i] == guessedCard)
                score += 1;
            else
                perfect = false;

            // Adjacent bonus
            int actualPos = actualRanking.IndexOf(guessedCard);
            if (actualPos >= 0 && Math.Abs(actualPos - i) == 1)
                score += 0.2;
        }

        if (perfect) score += 1; // Bonus

        return Math.Round(score, 2);
    }
}