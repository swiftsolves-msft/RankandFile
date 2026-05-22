'use client';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useState } from 'react';
import Card from './Card';
import { Card as CardType } from '../lib/types';

function SortableCardItem({ card, index }: { card: CardType; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.noun });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
      <div className="w-8 h-8 rounded-full bg-neon text-black flex items-center justify-center font-bold shrink-0">{index + 1}</div>
      <Card card={card} isSpicy={card.isSpicy} />
    </div>
  );
}

export default function RankingPhase({
  cards,
  onSubmit,
  onTimeUp,
  hasSubmitted = false,
}: {
  cards: CardType[];
  onSubmit: (ranked: string[]) => void;
  onTimeUp?: (getRanked: () => string[]) => void;
  hasSubmitted?: boolean;
}) {
  const [rankedCards, setRankedCards] = useState(cards);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (onTimeUp) {
      onTimeUp(() => rankedCards.map(c => c.noun));
    }
  }, [rankedCards, onTimeUp]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRankedCards((items) => {
        const oldIndex = items.findIndex(i => i.noun === active.id);
        const newIndex = items.findIndex(i => i.noun === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div>
      <h2 className="text-neon text-2xl mb-2">Rank the cards by importance</h2>
      <p className="text-zinc-400 text-sm mb-6">Drag to reorder — #1 is most important to you</p>

      <div className={hasSubmitted ? 'opacity-50 pointer-events-none' : ''}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rankedCards.map(c => c.noun)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {rankedCards.map((card, index) => (
                <SortableCardItem key={card.noun} card={card} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {hasSubmitted ? (
        <div className="mt-8 w-full py-4 rounded-xl border border-zinc-600 bg-zinc-800 text-center">
          <div className="flex items-center justify-center gap-3 text-zinc-400">
            <span className="animate-pulse text-neon text-lg">●</span>
            <span className="font-semibold">Ranking locked in — waiting for others…</span>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onSubmit(rankedCards.map(c => c.noun))}
          className="mt-8 w-full py-4 bg-neon text-black font-bold text-xl rounded-xl hover:bg-white transition"
        >
          LOCK IN RANKING
        </button>
      )}
    </div>
  );
}
