// Durable per-player identity, independent of the SignalR connection.
//
// The server used to key players by ConnectionId, so any refresh or dropped
// connection silently became a brand new player: the old entry lingered in the
// roster forever (inflating the head-count every round-completion check depends
// on) while the returning person restarted with no score.
//
// sessionStorage is the right lifetime here — it survives a refresh in the same
// tab, which is exactly the case we want to resume, but a fresh tab gets a fresh
// identity. That also lines up with tabGuard, which blocks a second *live* tab
// while explicitly allowing refresh-and-rejoin.

const STORAGE_KEY = 'rankfile-player-id';

let cached: string | null = null;

export function getPlayerId(): string {
  if (typeof window === 'undefined') return '';
  if (cached) return cached;

  let id: string | null = null;
  try {
    id = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing / storage disabled — fall through to an in-memory id,
    // which still holds for the life of the page.
  }

  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Ignore — cached below so it stays stable for this page at least.
    }
  }

  cached = id;
  return id;
}
