// Helpers for the "scan to join" QR code and the prefilled-join deep link.
//
// The QR code encodes a URL to the deployed app with the host's session code in
// a ?join=XXXXXX query param. When a player opens that link, the lobby prefills
// the join code so they only have to type their name and hit JOIN.

// Public URL of the deployed app. QR codes are scanned on phones/tablets that
// are NOT on the dev machine, so this must be the real production origin — not
// window.location.origin (which would be localhost during development).
//
// The short custom domain also keeps the encoded URL small, which means a
// lower-density QR code that scans faster from the back of a room.
export const PUBLIC_APP_URL = 'https://zerorank.net/';

const JOIN_QUERY = 'join';

/** Build the deep link a QR code should encode for a given session code. */
export function buildJoinUrl(sessionCode: string): string {
  const base = PUBLIC_APP_URL.replace(/\/+$/, '');
  return `${base}/?${JOIN_QUERY}=${encodeURIComponent(sessionCode)}`;
}

/** Read a prefilled join code from the current URL, if present. */
export function getPrefilledJoinCode(): string | null {
  if (typeof window === 'undefined') return null;
  const code = new URLSearchParams(window.location.search).get(JOIN_QUERY);
  if (!code) return null;
  // Session codes are 6 uppercase alphanumerics — normalize and validate.
  const normalized = code.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
}
