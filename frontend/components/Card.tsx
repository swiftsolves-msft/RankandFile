'use client';

import { Card as CardType } from '../lib/types';

export default function Card({ card, isSpicy, isMeme }: { card: CardType; isSpicy?: boolean; isMeme?: boolean }) {
  const displayTooltip = isMeme && card.tooltipMeme ? card.tooltipMeme : card.tooltip;
  return (
    <div className={`card ${isSpicy ? 'border-2 border-red-500 shadow-red-500/50' : ''}`}>
      <div className=”text-3xl font-bold text-center mb-6 text-white”>
        {card.noun}
      </div>
      <div className=”text-xs italic text-zinc-400 text-center border-t border-zinc-700 pt-3”>
        “{displayTooltip}”
      </div>
    </div>
  );
}