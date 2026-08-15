'use client';

import ConferencePanel from './ConferencePanel';
import { RoundAggregate } from '../../lib/types';

/**
 * Panel 1 — the room's collective ranking, ordered by mean rank, with a heat
 * strip per card showing how the votes actually spread across positions. The
 * strip is the point: two cards can share a mean rank while one was unanimous
 * and the other split the room down the middle.
 */
export default function RoomVerdict({
  aggregate,
  scale = 'normal',
}: {
  aggregate: RoundAggregate;
  scale?: 'normal' | 'large';
}) {
  const large = scale === 'large';
  const { consensus, submittedCount, mostDivisiveNoun } = aggregate;

  const divisive = consensus.find(c => c.noun === mostDivisiveNoun);
  const slots = consensus[0]?.distribution.length ?? 0;

  // Only worth calling out when the room genuinely disagreed.
  const footnote =
    divisive && divisive.spread > 0 && slots > 0 ? (
      <>
        <span className="text-zinc-300 font-semibold">Most divided:</span>{' '}
        <span className="text-white">{divisive.noun}</span> —{' '}
        {divisive.distribution[0]} put it #1, {divisive.distribution[slots - 1]} put it #{slots}.
      </>
    ) : null;

  return (
    <ConferencePanel
      title="The Room's Verdict"
      subtitle={`${submittedCount} ranked · consensus by mean rank`}
      footnote={footnote}
      scale={scale}
    >
      {consensus.map(c => {
        const max = Math.max(...c.distribution, 1);
        return (
          <div
            key={c.noun}
            className={`flex items-center ${large ? 'gap-4 mb-4' : 'gap-2.5 mb-2'}`}
          >
            <span
              className={`text-zinc-500 font-mono shrink-0 ${
                large ? 'text-2xl w-7' : 'text-[11px] w-3'
              }`}
            >
              {c.position}
            </span>

            <span className={`flex-1 min-w-0 text-white truncate ${large ? 'text-2xl' : 'text-xs'}`}>
              {c.noun}
              {c.isSpicy && (
                <span
                  className={`ml-2 text-red-400 align-middle ${large ? 'text-sm' : 'text-[9px]'}`}
                >
                  SPICY
                </span>
              )}
            </span>

            <span className={`flex shrink-0 ${large ? 'gap-1' : 'gap-[2px]'}`}>
              {c.distribution.map((v, i) => (
                <span
                  key={i}
                  title={`${v} put it #${i + 1}`}
                  className={`rounded-[2px] bg-neon ${large ? 'w-6 h-8' : 'w-2.5 h-4'}`}
                  style={{ opacity: 0.12 + 0.88 * (v / max) }}
                />
              ))}
            </span>

            <span
              className={`text-zinc-400 font-mono text-right shrink-0 ${
                large ? 'text-xl w-14' : 'text-[11px] w-7'
              }`}
            >
              {c.meanRank.toFixed(1)}
            </span>
          </div>
        );
      })}
    </ConferencePanel>
  );
}
