'use client';

import AlignmentPanel from './AlignmentPanel';
import ContrariansPanel from './ContrariansPanel';
import RankingCompare from './RankingCompare';
import RoomVerdict from './RoomVerdict';
import YourAlignment from './YourAlignment';
import { RoundAggregate } from '../../lib/types';

/** Which single panel to show, or the full 2x2. Drives the pop-out's 5 views. */
export type PanelFocus = 'all' | 'verdict' | 'alignment' | 'contrarians' | 'compare';

export const PANEL_TABS: { id: PanelFocus; label: string }[] = [
  { id: 'verdict', label: "Room's Verdict" },
  { id: 'alignment', label: 'Alignment' },
  { id: 'contrarians', label: 'Contrarians' },
  { id: 'compare', label: 'Host vs Room' },
  { id: 'all', label: 'All Four' },
];

/**
 * The end-of-round dashboard.
 *
 * Two projections of one payload: the `host` variant is the board that gets
 * shared to the room, the `player` variant is each person's private report —
 * same four squares, with panels 2 and 4 re-pointed from "the room" to "you".
 */
export default function ConferenceResults({
  aggregate,
  hostPlayerId,
  myPlayerId,
  myRanking,
  variant,
  focus = 'all',
  scale = 'normal',
}: {
  aggregate: RoundAggregate;
  hostPlayerId: string;
  myPlayerId: string | null;
  myRanking: string[];
  variant: 'host' | 'player';
  focus?: PanelFocus;
  scale?: 'normal' | 'large';
}) {
  const me = aggregate.alignments.find(a => a.playerId === myPlayerId) ?? null;

  const verdict = <RoomVerdict aggregate={aggregate} scale={scale} />;
  const contrarians = <ContrariansPanel aggregate={aggregate} scale={scale} />;

  const alignment =
    variant === 'host' ? (
      <AlignmentPanel aggregate={aggregate} hostPlayerId={hostPlayerId} scale={scale} />
    ) : (
      <YourAlignment aggregate={aggregate} me={me} scale={scale} />
    );

  const compare =
    variant === 'host' ? (
      <RankingCompare
        title="Host vs The Room"
        subtitle="the host's order, and where the room put each card"
        subject={aggregate.hostRanking}
        consensus={aggregate.consensus}
        emptyMessage="The host didn't submit a ranking this round."
        scale={scale}
      />
    ) : (
      <RankingCompare
        title="You vs The Room"
        subtitle="your order, and where the room put each card"
        subject={myRanking}
        consensus={aggregate.consensus}
        emptyMessage="No ranking recorded for you this round."
        scale={scale}
      />
    );

  if (focus !== 'all') {
    const single = { verdict, alignment, contrarians, compare }[focus];
    return <div className="h-full">{single}</div>;
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${scale === 'large' ? 'gap-6' : 'gap-4'}`}>
      {verdict}
      {alignment}
      {contrarians}
      {compare}
    </div>
  );
}
