namespace RankandFile.Core.Models;

public class Player
{
    public string PlayerId { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public double TotalScore { get; set; } = 0;
}