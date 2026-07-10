// Shared "how to play" content, used by both the in-app instructions splash
// (shown to joining players while they wait) and the presenter popup the host
// opens for screen sharing. One source of truth so the two never drift.

export interface InstructionSlide {
  emoji: string;
  title: string;
  body: string;
}

export const INSTRUCTION_SLIDES: InstructionSlide[] = [
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

// How long each slide stays on screen before advancing.
export const SLIDE_DURATION_MS = 8000;
