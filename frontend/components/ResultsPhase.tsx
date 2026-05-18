'use client';

import { useEffect, useState } from 'react';
import { Card, GuessResult } from '../lib/types';

const DISCUSSION_SECONDS = 90;

function MatchBadge({ match }: { match: 'exact' | 'near' | 'miss' | undefined }) {
  if (match === 'exact') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/40">EXACT +3</span>;
  if (match === 'near')  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">CLOSE +1</span>;
  return                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400 border border-zinc-600">MISS</span>;
}

function rowBg(match: 'exact' | 'near' | 'miss' | undefined) {
  if (match === 'exact') return 'border-green-500/30 bg-green-500/5';
  if (match === 'near')  return 'border-yellow-500/30 bg-yellow-500/5';
  return 'border-zinc-700 bg-zinc-900/50';
}

export default function ResultsPhase({
  result,
  cards,
}: {
  result: GuessResult;
  cards: Card[];
}) {
  const [timeLeft, setTimeLeft] = useState(DISCUSSION_SECONDS);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  const cardMap = Object.fromEntries(cards.map(c => [c.noun, c]));
  const maxScore = cards.length * 3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-1">
          Your guess vs <span className="text-cyber">{result.targetName}</span>
        </h2>
        <div className="text-5xl font-mono text-neon font-bold mt-2">
          {result.score} <span className="text-xl text-zinc-400">/ {maxScore} pts</span>
        </div>
      </div>

      {/* Card-by-card comparison */}
      <div className="rounded-2xl border border-zinc-700 overflow-hidden">
        <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-x-4 px-4 py-2 bg-zinc-800 text-xs uppercase text-zinc-400 font-bold">
          <span>#</span>
          <span>{result.targetName}&apos;s actual rank</span>
          <span>Your guess</span>
          <span>Points</span>
        </div>
        {result.actual.map((noun, i) => {
          const match = result.matchInfo?.[noun];
          const guessedNoun = result.guessed[i];
          const card = cardMap[noun];
          return (
            <div key={noun} className={`grid grid-cols-[2rem_1fr_1fr_auto] gap-x-4 px-4 py-3 border-t items-center ${rowBg(match)}`}>
              <span className="text-zinc-500 font-mono text-sm">{i + 1}</span>
              <div>
                <div className="text-white font-semibold text-sm">{noun}</div>
                {card && <div className="text-zinc-500 text-xs">{card.tooltip}</div>}
              </div>
              <div className={`text-sm font-semibold ${guessedNoun === noun ? 'text-green-400' : 'text-zinc-300'}`}>
                {guessedNoun}
              </div>
              <MatchBadge match={match} />
            </div>
          );
        })}
      </div>

      {/* Discussion timer */}
      <div className={`rounded-2xl border p-6 text-center transition-colors ${
        timeLeft <= 15 ? 'border-red-500/50 bg-red-500/5' : 'border-zinc-700 bg-zinc-900'
      }`}>
        <p className="text-zinc-400 text-sm mb-1 uppercase tracking-wider">Discussion time</p>
        <div className={`text-5xl font-mono font-bold ${timeLeft <= 15 ? 'text-red-400' : 'text-neon'}`}>
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
        <p className="text-zinc-500 text-xs mt-2">
          Talk it out — why did you rank them that way?
        </p>
      </div>
    </div>
  );
}
