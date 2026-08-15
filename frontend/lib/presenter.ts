// Helpers for the host's "screen share" popup.
//
// The popup is just the same SPA loaded with ?present=1. It holds no SignalR
// connection and no game state of its own — the host's main window pushes
// everything it needs over a BroadcastChannel (same browser, same origin).
//
// Messages only ever flow host -> popup, except for `presenter-ready`. That one
// exists because the popup can be opened at any moment, including after results
// have already been published: on mount it announces itself and the host replays
// the latest payload. Without it, opening the window late would show an empty
// screen until the next round.

import { RoundAggregate } from './types';

const PRESENTER_CHANNEL = 'rankfile-presenter';
const PRESENT_QUERY = 'present';

/** What the popup needs to render the Conference dashboards. */
export interface PresenterResults {
  aggregate: RoundAggregate;
  hostPlayerId: string;
  maxRounds: number;
}

export type PresenterMessage =
  | { type: 'game-started' }
  /** Popup -> host: "I just opened, send me current state." */
  | { type: 'presenter-ready' }
  | { type: 'round-aggregate'; payload: PresenterResults }
  | { type: 'round-reset'; roundNum: number; maxRounds: number }
  /** Host -> popup: which instruction deck to loop while in the lobby. */
  | { type: 'lobby-state'; gameMode: string };

/** True when this window/tab was opened as the presenter (screen-share) view. */
export function isPresenterView(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(PRESENT_QUERY);
}

/** Read the session code embedded in the presenter URL, if present. */
export function getPresenterSessionCode(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('code');
}

/**
 * Game mode carried in the presenter URL. Seeded at open time so the popup shows
 * the right instruction deck on its very first frame; `lobby-state` messages
 * keep it current if the host switches mode afterwards.
 */
export function getPresenterGameMode(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('mode');
}

/** Open the presenter popup in a new window (reused across calls by name). */
export function openPresenterWindow(sessionCode?: string, gameMode?: string): void {
  const code = sessionCode ? `&code=${encodeURIComponent(sessionCode)}` : '';
  const mode = gameMode ? `&mode=${encodeURIComponent(gameMode)}` : '';
  const url = `${window.location.origin}${window.location.pathname}?${PRESENT_QUERY}=1${code}${mode}`;
  window.open(url, 'rankfile-instructions', 'width=1280,height=800');
}

function post(message: PresenterMessage): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const ch = new BroadcastChannel(PRESENTER_CHANNEL);
  ch.postMessage(message);
  ch.close();
}

/**
 * Subscribe to the presenter channel. Returns an unsubscribe function.
 *
 * A BroadcastChannel never delivers to the instance that sent the message, but
 * it does deliver to other instances in the *same* window — so a sender that
 * also subscribes will hear itself. That is harmless here only because the host
 * and the popup handle disjoint message types; keep it that way.
 */
export function subscribePresenter(cb: (message: PresenterMessage) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(PRESENTER_CHANNEL);
  ch.onmessage = (ev: MessageEvent) => cb(ev.data as PresenterMessage);
  return () => ch.close();
}

/** Host calls this when the game starts so the presenter popup stops looping. */
export function notifyPresenterGameStarted(): void {
  post({ type: 'game-started' });
}

/**
 * Presenter window subscribes to know when the game has started. Returns an
 * unsubscribe function.
 */
export function onPresenterGameStarted(cb: () => void): () => void {
  return subscribePresenter(m => {
    if (m.type === 'game-started') cb();
  });
}

/** Host -> popup: render this round's Conference dashboards. */
export function publishPresenterResults(payload: PresenterResults): void {
  post({ type: 'round-aggregate', payload });
}

/** Host -> popup: which instruction deck to loop while waiting in the lobby. */
export function publishPresenterLobbyState(gameMode: string): void {
  post({ type: 'lobby-state', gameMode });
}

/** Host -> popup: a new round is underway, clear the last results. */
export function notifyPresenterRoundReset(roundNum: number, maxRounds: number): void {
  post({ type: 'round-reset', roundNum, maxRounds });
}

/** Popup -> host: ask for the current state (see the note at the top). */
export function requestPresenterState(): void {
  post({ type: 'presenter-ready' });
}
