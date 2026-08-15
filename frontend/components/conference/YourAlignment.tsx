'use client';

import ConferencePanel from './ConferencePanel';
import { PlayerAlignment, RoundAggregate } from '../../lib/types';

/**
 * Panel 2 (personal report) — the player's own standing, shown against the room
 * average rather than as an ordinal position.
 *
 * Deliberately no "11th of 24": a rank would quietly tell the player that
 * agreeing with the room is winning, which is the conformity-scoring Conference
 * mode is built to avoid.
 */
export default function YourAlignment({
  aggregate,
  me,
  scale = 'normal',
}: {
  aggregate: RoundAggregate;
  me: PlayerAlignment | null;
  scale?: 'normal' | 'large';
}) {
  const large = scale === 'large';

  if (!me) {
    return (
      <ConferencePanel title="Your Alignment" scale={scale}>
        <p className={`text-zinc-500 ${large ? 'text-xl' : 'text-xs'}`}>
          No ranking recorded for you this round.
        </p>
      </ConferencePanel>
    );
  }

  const average = aggregate.roomAverageAlignment;
  const delta = Math.round((me.toRoom - average) * 10) / 10;

  const verdict =
    delta > 0
      ? `${delta} points above the room average`
      : delta < 0
        ? `${Math.abs(delta)} points below the room average`
        : 'exactly the room average';

  return (
    <ConferencePanel
      title="Your Alignment"
      subtitle="how closely you tracked the room"
      scale={scale}
    >
      <div className="flex flex-col items-center justify-center h-full">
        <p className={`font-bold text-neon leading-none ${large ? 'text-8xl' : 'text-5xl'}`}>
          {me.toRoom}%
        </p>

        {/* Where the player sits relative to the room average. */}
        <div className={`relative w-full ${large ? 'mt-8 h-3' : 'mt-5 h-1.5'}`}>
          <div className="absolute inset-0 bg-zinc-800 rounded-full" />
          <div
            className="absolute inset-y-0 left-0 bg-neon rounded-full"
            style={{ width: `${me.toRoom}%` }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-cyber"
            style={{ left: `${average}%` }}
            title={`room average ${average}%`}
          />
        </div>

        <p className={`text-zinc-400 ${large ? 'text-xl mt-5' : 'text-[11px] mt-3'}`}>{verdict}</p>
        <p className={`text-zinc-600 ${large ? 'text-base mt-1' : 'text-[10px] mt-0.5'}`}>
          room averaged <span className="text-cyber">{average}%</span>
        </p>
      </div>
    </ConferencePanel>
  );
}
