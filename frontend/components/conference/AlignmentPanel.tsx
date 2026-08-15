'use client';

import { useMemo, useState } from 'react';
import ConferencePanel from './ConferencePanel';
import { PlayerAlignment, RoundAggregate } from '../../lib/types';

type Mode = 'room' | 'host';

type Row =
  | { kind: 'player'; player: PlayerAlignment }
  | { kind: 'gap'; hidden: number };

/**
 * Collapses a big room down to the ends of the distribution — the top and
 * bottom are where the conversation is, and a projector cannot show 40 rows.
 * The host is always pulled in, even when they land in the hidden middle.
 */
function condense(list: PlayerAlignment[], hostPlayerId: string): Row[] {
  if (list.length <= 8) return list.map(player => ({ kind: 'player', player }));

  const top = list.slice(0, 5);
  const bottom = list.slice(-3);
  const visible = new Set([...top, ...bottom].map(p => p.playerId));

  const host = list.find(p => p.playerId === hostPlayerId);
  const hostHidden = host !== undefined && !visible.has(host.playerId);

  const rows: Row[] = top.map(player => ({ kind: 'player', player }));
  if (hostHidden && host) rows.push({ kind: 'player', player: host });

  const hidden = list.length - top.length - bottom.length - (hostHidden ? 1 : 0);
  if (hidden > 0) rows.push({ kind: 'gap', hidden });

  bottom.forEach(player => rows.push({ kind: 'player', player }));
  return rows;
}

/**
 * Panel 2 (host board) — how closely each player tracked the room, or the host.
 *
 * Presented as a distribution, never as a scoreboard: Conference mode awards no
 * points, because ranking people by how well they match the consensus would
 * reward conformity and punish exactly the minority opinions worth discussing.
 */
export default function AlignmentPanel({
  aggregate,
  hostPlayerId,
  scale = 'normal',
}: {
  aggregate: RoundAggregate;
  hostPlayerId: string;
  scale?: 'normal' | 'large';
}) {
  const large = scale === 'large';
  const [mode, setMode] = useState<Mode>('room');

  const canCompareToHost = aggregate.hasHostRanking;
  const active: Mode = canCompareToHost ? mode : 'room';

  const rows = useMemo(() => {
    const sorted = [...aggregate.alignments].sort((a, b) =>
      active === 'room' ? b.toRoom - a.toRoom : b.toHost - a.toHost
    );
    return condense(sorted, hostPlayerId);
  }, [aggregate.alignments, active, hostPlayerId]);

  const value = (p: PlayerAlignment) => (active === 'room' ? p.toRoom : p.toHost);

  return (
    <ConferencePanel
      title="Alignment"
      subtitle={
        active === 'room'
          ? `how closely each player tracked the room · avg ${aggregate.roomAverageAlignment}%`
          : 'how closely each player tracked the host'
      }
      scale={scale}
    >
      {canCompareToHost && (
        <div className={`flex ${large ? 'gap-2 mb-5' : 'gap-1 mb-3'}`}>
          {(['room', 'host'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg font-semibold transition border ${
                large ? 'px-4 py-2 text-base' : 'px-2.5 py-1 text-[10px]'
              } ${
                active === m
                  ? 'bg-cyber/20 border-cyber text-cyber'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {m === 'room' ? 'vs Room' : 'vs Host'}
            </button>
          ))}
        </div>
      )}

      {rows.map((row, i) =>
        row.kind === 'gap' ? (
          <div
            key={`gap-${i}`}
            className={`text-zinc-600 text-center ${large ? 'text-base py-3' : 'text-[10px] py-1'}`}
          >
            ··· {row.hidden} more ···
          </div>
        ) : (
          <div
            key={row.player.playerId}
            className={`flex items-center rounded ${large ? 'gap-3 mb-3 px-2 py-1' : 'gap-2 mb-1.5 px-1'} ${
              row.player.playerId === hostPlayerId ? 'bg-cyber/10' : ''
            }`}
          >
            <span
              className={`flex-1 min-w-0 truncate ${
                row.player.playerId === hostPlayerId ? 'text-cyber' : 'text-zinc-200'
              } ${large ? 'text-xl' : 'text-xs'}`}
            >
              {row.player.name}
              {row.player.playerId === hostPlayerId && (
                <span className={large ? 'text-sm ml-2' : 'text-[9px] ml-1.5'}>HOST</span>
              )}
            </span>

            <span
              className={`bg-zinc-800 rounded-full overflow-hidden shrink-0 ${
                large ? 'h-3 w-40' : 'h-1.5 w-20'
              }`}
            >
              <span
                className="block h-full bg-neon rounded-full"
                style={{ width: `${value(row.player)}%` }}
              />
            </span>

            <span
              className={`text-zinc-400 font-mono text-right shrink-0 ${
                large ? 'text-xl w-16' : 'text-[11px] w-9'
              }`}
            >
              {value(row.player)}%
            </span>
          </div>
        )
      )}
    </ConferencePanel>
  );
}
