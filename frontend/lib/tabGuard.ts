// One-person-per-browser guard for joining/hosting a game.
//
// Uses the BroadcastChannel API to detect whether another tab or window in the
// SAME browser is already inside a game session. This precisely targets the
// "same device + same browser, multiple tabs/windows" case from the
// requirement: a refreshed or closed tab stops answering probes immediately,
// so a legitimate refresh-and-rejoin is never falsely blocked, while a second
// *live* tab is.
//
// Degrades gracefully: if BroadcastChannel is unavailable, the guard allows
// the action (no false blocks).

export const DUPLICATE_TAB_MESSAGE =
  'Please one person per game, this is used for matching you with others in each round and leaderboard';

const CHANNEL_NAME = 'rankfile-tabs';
// Unique per page load. A refresh produces a new id, so the pre-refresh tab is
// correctly treated as "gone" once its channel is torn down.
const TAB_ID = Math.random().toString(36).slice(2);

let channel: BroadcastChannel | null = null;
let inSession = false;

function ensureChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof BroadcastChannel === 'undefined') return null;

  channel = new BroadcastChannel(CHANNEL_NAME);
  // Persistent handler: answer probes from other tabs while we're in a session.
  channel.onmessage = (ev: MessageEvent) => {
    const msg = ev.data;
    if (msg?.type === 'probe' && msg.from !== TAB_ID && inSession) {
      channel?.postMessage({ type: 'busy', from: TAB_ID });
    }
  };
  return channel;
}

/**
 * Mark whether this tab is currently inside an active game session. Tabs that
 * are in a session will answer probes from other tabs as "busy".
 */
export function setInSession(value: boolean): void {
  inSession = value;
  ensureChannel();
}

/**
 * Resolves true if it's OK for this tab to enter a session (no other live tab
 * in this browser is already in one), false if another tab is busy.
 */
export function canEnterSession(timeoutMs = 200): Promise<boolean> {
  const ch = ensureChannel();
  if (!ch) return Promise.resolve(true); // no BroadcastChannel → don't block

  return new Promise((resolve) => {
    let busy = false;
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === 'busy' && ev.data.from !== TAB_ID) busy = true;
    };
    ch.addEventListener('message', onMsg);
    ch.postMessage({ type: 'probe', from: TAB_ID });
    setTimeout(() => {
      ch.removeEventListener('message', onMsg);
      resolve(!busy);
    }, timeoutMs);
  });
}
