'use client';

import { useEffect, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Card from './Card';
import { Card as CardType } from '../lib/types';

function SortableCardItem({ card, index, isMeme }: { card: CardType; index: number; isMeme?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.noun });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
      <div className="w-8 h-8 rounded-full bg-cyber text-black flex items-center justify-center font-bold shrink-0">{index + 1}</div>
      <Card card={card} isSpicy={card.isSpicy} isMeme={isMeme} />
    </div>
  );
}

export default function GuessingPhase({
  targetName,
  cards,
  isTriple,
  cycleInfo,
  onSubmit,
  onTimeUp,
  hasSubmitted = false,
  isMeme = false,
}: {
  targetName: string;
  cards: CardType[];
  isTriple?: boolean;
  cycleInfo?: string;
  onSubmit: (guessed: string[]) => void;
  onTimeUp?: (getRanked: () => string[]) => void;
  hasSubmitted?: boolean;
  isMeme?: boolean;
}) {
  const [guess, setGuess] = useState(cards);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (onTimeUp) {
      onTimeUp(() => guess.map(c => c.noun));
    }
  }, [guess, onTimeUp]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setGuess((items) => {
        const oldIndex = items.findIndex(i => i.noun === active.id);
        const newIndex = items.findIndex(i => i.noun === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div>
      <h2 className="text-cyber text-3xl mb-2">
        How did <span className="font-bold">{targetName}</span> rank them?
      </h2>
      <p className="text-zinc-400 text-sm mb-4">Drag to order by what you think <strong>{targetName}</strong> values most</p>
      {isTriple && <p className="text-red-400 mb-4">{cycleInfo}</p>}

      <div className={hasSubmitted ? 'opacity-50 pointer-events-none' : ''}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={guess.map(c => c.noun)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4 mb-8">
              {guess.map((card, index) => (
                <SortableCardItem key={card.noun} card={card} index={index} isMeme={isMeme} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {hasSubmitted ? (
        <div className="w-full py-4 rounded-xl border border-zinc-600 bg-zinc-800 text-center">
          <div className="flex items-center justify-center gap-3 text-zinc-400">
            <span className="animate-pulse text-cyber text-lg">●</span>
            <span className="font-semibold">Guess submitted — waiting for others…</span>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onSubmit(guess.map(c => c.noun))}
          className="w-full py-4 bg-cyber text-black font-bold text-xl rounded-xl hover:bg-white transition"
        >
          SUBMIT GUESS
        </button>
      )}
    </div>
  );
}
