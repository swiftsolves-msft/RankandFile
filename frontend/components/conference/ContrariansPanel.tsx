'use client';

import ConferencePanel from './ConferencePanel';
import { RoundAggregate } from '../../lib/types';

/**
 * Panel 3 — the players furthest from consensus, named, each with the single
 * card they diverged on hardest.
 *
 * Framed as an invitation, not a penalty. These are the most interesting people
 * in the room for the next two minutes of conversation, which is why the panel
 * leads with the hot take rather than the number.
 */
export default function ContrariansPanel({
  aggregate,
  scale = 'normal',
}: {
  aggregate: RoundAggregate;
  scale?: 'normal' | 'large';
}) {
  const large = scale === 'large';
  const { outliers } = aggregate;

  return (
    <ConferencePanel
      title="The Contrarians"
      subtitle="furthest from consensus — ask them why"
      scale={scale}
    >
      {outliers.length === 0 ? (
        <p className={`text-zinc-500 ${large ? 'text-xl' : 'text-xs'}`}>
          The room was unanimous — nobody broke away this round.
        </p>
      ) : (
        outliers.map(o => (
          <div
            key={o.playerId}
            className={`border-l-2 border-red-500/50 ${
              large ? 'pl-5 mb-6' : 'pl-3 mb-3'
            }`}
          >
            <div className="flex items-baseline gap-2">
              <span
                className={`text-white font-semibold truncate ${large ? 'text-2xl' : 'text-xs'}`}
              >
                {o.name}
              </span>
              <span
                className={`text-red-400 font-mono shrink-0 ${large ? 'text-base' : 'text-[10px]'}`}
              >
                {o.toRoom}% aligned
              </span>
            </div>
            <p className={`text-zinc-400 leading-snug ${large ? 'text-lg mt-1' : 'text-[11px] mt-0.5'}`}>
              Ranked <span className="text-white font-semibold">{o.noun}</span> #{o.theirPosition} —
              the room said #{o.roomPosition}.
            </p>
          </div>
        ))
      )}
    </ConferencePanel>
  );
}
