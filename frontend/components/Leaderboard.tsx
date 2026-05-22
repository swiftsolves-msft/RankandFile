import { Player } from '../lib/types';

export default function Leaderboard({
  players,
  isFinal = false,
  currentRound = 0,
  maxRounds = 0,
}: {
  players: Player[];
  isFinal?: boolean;
  currentRound?: number;
  maxRounds?: number;
}) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-6">
      <div className="mb-6">
        {isFinal ? (
          <div className="text-center space-y-1">
            <h2 className="text-neon text-2xl font-bold">Congratulations on the discussion!</h2>
            <p className="text-zinc-400 text-sm">Final standings after {maxRounds} rounds</p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h2 className="text-neon text-2xl">Leaderboard</h2>
            {currentRound > 0 && maxRounds > 0 && (
              <span className="text-zinc-400 text-sm font-mono">
                Round {currentRound} of {maxRounds} complete
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {players.map((p, i) => (
          <div key={p.playerId} className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-cyber">#{i + 1}</span>
              <span>{p.name}</span>
            </div>
            <span className="text-3xl font-mono text-neon">{p.totalScore}</span>
          </div>
        ))}
      </div>
    </div>
  );
}