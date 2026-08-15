// Shared "how to play" content, used by both the in-app instructions splash
// (shown to joining players while they wait) and the presenter popup the host
// opens for screen sharing. One source of truth so the two never drift.
//
// One set per game mode: the two play completely differently, and showing a
// conference room "you'll be paired with a partner" would be actively wrong.

export interface InstructionSlide {
  emoji: string;
  title: string;
  body: string;
}

export const ICEBREAKER_SLIDES: InstructionSlide[] = [
  {
    emoji: '🎯',
    title: 'Welcome to Rank & File',
    body: 'A quick cybersecurity icebreaker. Discover what your teammates value most — and how well you really know each other.',
  },
  {
    emoji: '🃏',
    title: 'Step 1 — Rank Your Cards',
    body: 'You are dealt a hand of cybersecurity cards. Drag them into order, from what matters MOST to you down to least.',
  },
  {
    emoji: '🤝',
    title: 'Step 2 — Guess Your Partner',
    body: 'You are paired with another player. Put THEIR cards in the order you think they chose.',
  },
  {
    emoji: '🏆',
    title: 'Step 3 — Score & Discuss',
    body: 'Earn points for every card you place correctly. Then talk it out — why did each of you rank them that way?',
  },
  {
    emoji: '💡',
    title: 'The Whole Point',
    body: 'Spark conversation, compare perspectives, and connect with your team. There are no wrong answers here.',
  },
];

export const CONFERENCE_SLIDES: InstructionSlide[] = [
  {
    emoji: '🎤',
    title: 'Rank & File — Conference Mode',
    body: 'No partners and no guessing. Everyone in the room ranks the same cards, and we find out what this room actually believes.',
  },
  {
    emoji: '🃏',
    title: 'Step 1 — Rank Your Cards',
    body: 'Everyone is dealt the same 5 cybersecurity cards. Drag them into order, from what matters MOST to you down to least.',
  },
  {
    emoji: '⏱️',
    title: 'Step 2 — Beat the Clock',
    body: 'Rankings close when the timer runs out — no waiting on stragglers. Whatever you have in order when time is up is what counts.',
  },
  {
    emoji: '📊',
    title: 'Step 3 — See the Room',
    body: 'Every answer is combined into one collective ranking, then shown on the big screen: what the room agreed on, and what split it.',
  },
  {
    emoji: '💬',
    title: 'The Whole Point',
    body: 'No points and no winner. If you ranked things differently from everyone else, you are the most interesting person here — expect to be asked why.',
  },
];

/**
 * Compare against 'conference' rather than 'icebreaker': a session created
 * before the game-mode axis existed carries a card-mode value in this field, and
 * falling through to the icebreaker set is the correct default.
 */
export function slidesFor(gameMode: string | undefined): InstructionSlide[] {
  return gameMode === 'conference' ? CONFERENCE_SLIDES : ICEBREAKER_SLIDES;
}

// How long each slide stays on screen before advancing.
export const SLIDE_DURATION_MS = 8000;
