// Helpers for the host's "screen share" instructions popup.
//
// The popup is just the same SPA loaded with ?present=1, which renders a
// full-screen looping instructions view (no SignalR, no game state). When the
// host starts the game, the main window signals the popup — same browser, same
// origin — over a BroadcastChannel so it stops looping.

const PRESENTER_CHANNEL = 'rankfile-presenter';
const PRESENT_QUERY = 'present';

/** True when this window/tab was opened as the presenter (screen-share) view. */
export function isPresenterView(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(PRESENT_QUERY);
}

/** Open the presenter instructions popup in a new window. */
export function openPresenterWindow(): void {
  const url = `${window.location.origin}${window.location.pathname}?${PRESENT_QUERY}=1`;
  window.open(url, 'rankfile-instructions', 'width=1280,height=800');
}

/** Host calls this when the game starts so the presenter popup stops looping. */
export function notifyPresenterGameStarted(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const ch = new BroadcastChannel(PRESENTER_CHANNEL);
  ch.postMessage({ type: 'game-started' });
  ch.close();
}

/**
 * Presenter window subscribes to know when the game has started. Returns an
 * unsubscribe function.
 */
export function onPresenterGameStarted(cb: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(PRESENTER_CHANNEL);
  ch.onmessage = (ev: MessageEvent) => {
    if (ev.data?.type === 'game-started') cb();
  };
  return () => ch.close();
}
