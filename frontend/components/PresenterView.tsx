'use client';

import { useCallback, useEffect, useState } from 'react';
import InstructionsLoop from './InstructionsLoop';
import JoinQR from './JoinQR';
import ConferenceResults, { PANEL_TABS, PanelFocus } from './conference/ConferenceResults';
import {
  PresenterResults,
  getPresenterGameMode,
  getPresenterSessionCode,
  requestPresenterState,
  subscribePresenter,
} from '../lib/presenter';

/**
 * Full-screen view opened by the host in a separate window for screen sharing
 * (Teams / Webex / a projector at an event).
 *
 * Three states, in order of precedence:
 *   1. Conference results published  -> the dashboards, tab by tab
 *   2. Game started, no results yet  -> "follow along on the main screen"
 *   3. Lobby                         -> looping how-to-play + join code
 *
 * Holds no game connection: everything arrives over the BroadcastChannel from
 * the host's window.
 */
export default function PresenterView() {
  const [started, setStarted] = useState(false);
  const [results, setResults] = useState<PresenterResults | null>(null);
  const [roundLabel, setRoundLabel] = useState<string | null>(null);
  const [focus, setFocus] = useState<PanelFocus>('all');
  const sessionCode = getPresenterSessionCode();
  // Seeded from the URL so the correct deck shows on the first frame, then kept
  // current by `lobby-state` if the host switches mode while this window is open.
  const [gameMode, setGameMode] = useState<string>(() => getPresenterGameMode() ?? 'icebreaker');

  useEffect(() => {
    const unsubscribe = subscribePresenter(m => {
      if (m.type === 'game-started') {
        setStarted(true);
      } else if (m.type === 'round-aggregate') {
        setResults(m.payload);
        setStarted(true);
        setRoundLabel(`Round ${m.payload.aggregate.roundNum} of ${m.payload.maxRounds}`);
      } else if (m.type === 'round-reset') {
        setResults(null);
        setStarted(true);
        setRoundLabel(`Round ${m.roundNum} of ${m.maxRounds}`);
      } else if (m.type === 'lobby-state') {
        setGameMode(m.gameMode);
      }
    });

    // Announce ourselves so the host replays whatever is current — this window
    // may well have been opened after results were already published.
    requestPresenterState();
    return unsubscribe;
  }, []);

  // Arrow keys cycle the views, so the host can drive from a clicker.
  const cycle = useCallback((step: number) => {
    setFocus(current => {
      const i = PANEL_TABS.findIndex(t => t.id === current);
      const next = (i + step + PANEL_TABS.length) % PANEL_TABS.length;
      return PANEL_TABS[next].id;
    });
  }, []);

  useEffect(() => {
    if (!results) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') cycle(1);
      else if (e.key === 'ArrowLeft') cycle(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [results, cycle]);

  // ---- 1. Conference results ----
  if (results) {
    return (
      <div className="fixed inset-0 flex flex-col bg-black">
        <div className="shrink-0 flex flex-wrap items-center justify-center gap-3 px-8 py-5 border-b border-zinc-800">
          {PANEL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFocus(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-bold text-lg transition border-2 ${
                focus === tab.id
                  ? 'bg-cyber text-black border-cyber'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-cyber hover:text-cyber'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-8">
          <ConferenceResults
            aggregate={results.aggregate}
            hostPlayerId={results.hostPlayerId}
            myPlayerId={results.hostPlayerId}
            myRanking={results.aggregate.hostRanking}
            variant="host"
            focus={focus}
            // A single panel gets the full window, so it can be read from the
            // back of a room. The 2x2 overview stays at normal scale to fit.
            scale={focus === 'all' ? 'normal' : 'large'}
          />
        </div>

        <div className="shrink-0 flex items-center justify-between px-8 py-3 border-t border-zinc-800">
          <p className="text-zinc-600 text-sm">← → to change view</p>
          {roundLabel && <p className="text-zinc-500 text-sm font-mono">{roundLabel}</p>}
        </div>
      </div>
    );
  }

  // ---- 2. Game running, waiting on results ----
  if (started) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black px-10 text-center">
        <div className="text-9xl mb-8">🎮</div>
        <h2 className="text-6xl md:text-7xl font-extrabold text-neon mb-6 drop-shadow-[0_0_24px_rgba(0,255,170,0.4)]">
          The game has started!
        </h2>
        <p className="text-3xl md:text-4xl text-zinc-300">Follow along on the main screen.</p>
        {roundLabel && <p className="text-2xl text-zinc-500 font-mono mt-8">{roundLabel}</p>}
      </div>
    );
  }

  // ---- 3. Lobby ----
  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {sessionCode && (
        <div className="shrink-0 flex items-center justify-center gap-8 py-6 border-b border-zinc-800">
          <p className="text-4xl md:text-5xl font-bold text-zinc-100">
            Use Code{' '}
            <span className="text-neon font-mono drop-shadow-[0_0_16px_rgba(0,255,170,0.5)]">
              {sessionCode}
            </span>{' '}
            to Join Session
          </p>
          <JoinQR sessionCode={sessionCode} size={128} />
        </div>
      )}
      <InstructionsLoop variant="presenter" gameMode={gameMode} />
    </div>
  );
}
