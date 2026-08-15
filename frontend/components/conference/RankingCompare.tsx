'use client';

import ConferencePanel from './ConferencePanel';
import { ConsensusCard } from '../../lib/types';

/**
 * Panel 4 — one person's ranking laid against the room's, card by card.
 *
 * Serves both projections: the host board passes the host's ranking
 * ("Host vs The Room"), a player's personal report passes their own
 * ("You vs The Room").
 *
 * Listing the subject's order and annotating where the room put each card is
 * unambiguous in a way parallel columns are not — side-by-side lists leave it
 * unclear which column a delta belongs to.
 */
export default function RankingCompare({
  title,
  subtitle,
  subject,
  consensus,
  emptyMessage,
  scale = 'normal',
}: {
  title: string;
  subtitle: string;
  subject: string[];
  consensus: ConsensusCard[];
  emptyMessage: string;
  scale?: 'normal' | 'large';
}) {
  const large = scale === 'large';

  if (subject.length === 0) {
    return (
      <ConferencePanel title={title} scale={scale}>
        <p className={`text-zinc-500 ${large ? 'text-xl' : 'text-xs'}`}>{emptyMessage}</p>
      </ConferencePanel>
    );
  }

  return (
    <ConferencePanel
      title={title}
      subtitle={subtitle}
      footnote={
        <>
          <span className="text-neon">▲</span> room rated it higher ·{' '}
          <span className="text-amber-400">▼</span> room rated it lower
        </>
      }
      scale={scale}
    >
      {subject.map((noun, i) => {
        const roomPosition = consensus.findIndex(c => c.noun === noun) + 1;
        const mine = i + 1;
        // Positive means the room pushed it further down the list than this
        // person did; negative means the room rated it more important.
        const diff = roomPosition > 0 ? roomPosition - mine : 0;
        const wide = Math.abs(diff) >= 2;

        return (
          <div
            key={noun}
            className={`flex items-center ${large ? 'gap-4 mb-4' : 'gap-2.5 mb-2'}`}
          >
            <span
              className={`text-zinc-500 font-mono shrink-0 ${
                large ? 'text-2xl w-7' : 'text-[11px] w-3'
              }`}
            >
              {mine}
            </span>

            <span className={`flex-1 min-w-0 text-white truncate ${large ? 'text-2xl' : 'text-xs'}`}>
              {noun}
            </span>

            <span
              className={`text-zinc-500 font-mono shrink-0 ${
                large ? 'text-xl w-20 text-right' : 'text-[11px] w-11 text-right'
              }`}
            >
              room #{roomPosition > 0 ? roomPosition : '—'}
            </span>

            <span
              className={`font-mono text-right shrink-0 ${large ? 'text-xl w-14' : 'text-[11px] w-8'} ${
                diff === 0
                  ? 'text-zinc-600'
                  : diff < 0
                    ? wide ? 'text-neon' : 'text-neon/60'
                    : wide ? 'text-amber-400' : 'text-amber-400/60'
              }`}
            >
              {diff === 0 ? '—' : `${diff < 0 ? '▲' : '▼'}${Math.abs(diff)}`}
            </span>
          </div>
        );
      })}
    </ConferencePanel>
  );
}
