import { Player } from '../lib/types';

export default function Leaderboard({ players, isFinal = false }: { players: Player[]; isFinal?: boolean }) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-6">
      <h2 className="text-neon text-2xl mb-6">{isFinal ? '🏆 Final Standings' : 'Leaderboard'}</h2>
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