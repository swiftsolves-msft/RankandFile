// Landing-page quotes, rotated one at a time beneath the wordmark.
//
// Deliberately dry industry observations rather than marketing copy — they set
// the tone for a game whose whole premise is that security opinions are
// contested.

export const LANDING_QUOTES: string[] = [
  'Most breaches still start with something embarrassingly basic.',
  'On a long enough timeline, your detection rate still won’t matter.',
  'Patching is necessary but insufficient. Most successful attacks don’t need zero-days.',
  'On a long enough timeline, the survival rate for everyone drops to zero.',
  'Your C2 is noisier than you think, and blue teams are getting better at mapping it.',
  'On a long enough timeline, every organization gets breached. The only real variables are dwell time and blast radius.',
  '“AI-powered” is still doing a lot of heavy lifting in the pitch deck.',
  'Is this thing on? Sir, this is a Burger King.',
];

/** How long each quote holds before the next one fades in. */
export const QUOTE_DURATION_MS = 7000;
