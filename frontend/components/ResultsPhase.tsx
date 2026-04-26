import { GuessResult } from '../lib/types';

export default function ResultsPhase({ result }: { result: GuessResult }) {
  return (
    <div className="bg-zinc-900 rounded-3xl p-8 border border-neon/50">
      <h2 className="text-3xl font-bold text-neon mb-4">Your Guess vs {result.targetName}</h2>
      <div className="text-6xl font-mono text-center mb-8 text-white">{result.score} pts</div>
      
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="text-xs uppercase mb-2 text-zinc-400">Their actual rank</p>
          <ol className="space-y-2">
            {result.actual.map((c: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm"><span className="text-neon">{i+1}.</span> {c}</li>
            ))}
          </ol>
        </div>
        <div>
          <p className="text-xs uppercase mb-2 text-zinc-400">Your guess</p>
          <ol className="space-y-2">
            {result.guessed.map((c: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm"><span className="text-cyber">{i+1}.</span> {c}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}