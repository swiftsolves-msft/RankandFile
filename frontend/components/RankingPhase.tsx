'use client';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';
import Card from './Card';
import { Card as CardType } from '../lib/types';

export default function RankingPhase({
  cards,
  onSubmit,
  onTimeUp,
}: {
  cards: CardType[];
  onSubmit: (ranked: string[]) => void;
  onTimeUp?: (getRanked: () => string[]) => void;
}) {
  const [rankedCards, setRankedCards] = useState(cards);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Expose current ranking to parent for auto-submit on timer expiry
  useEffect(() => {
    if (onTimeUp) {
      onTimeUp(() => rankedCards.map(c => c.noun));
    }
  }, [rankedCards, onTimeUp]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setRankedCards((items) => {
        const oldIndex = items.findIndex(i => i.noun === active.id);
        const newIndex = items.findIndex(i => i.noun === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div>
      <h2 className="text-neon text-2xl mb-6">Rank the cards by importance (30s)</h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rankedCards.map(c => c.noun)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {rankedCards.map((card, index) => (
              <div key={card.noun} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-neon text-black flex items-center justify-center font-bold">{index + 1}</div>
                <Card card={card} isSpicy={card.isSpicy} />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={() => onSubmit(rankedCards.map(c => c.noun))}
        className="mt-8 w-full py-4 bg-neon text-black font-bold text-xl rounded-xl hover:bg-white transition"
      >
        SUBMIT RANKING
      </button>
    </div>
  );
}