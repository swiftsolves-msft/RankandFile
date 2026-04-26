'use client';

import { useEffect, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';
import { Card as CardType } from '../lib/types';

export default function GuessingPhase({ 
  targetName, 
  cards, 
  isTriple, 
  cycleInfo, 
  onSubmit,
  onTimeUp,
}: { 
  targetName: string; 
  cards: CardType[]; 
  isTriple?: boolean; 
  cycleInfo?: string; 
  onSubmit: (guessed: string[]) => void;
  onTimeUp?: (getRanked: () => string[]) => void;
}) {
  const [guess, setGuess] = useState(cards);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Expose current guess to parent for auto-submit on timer expiry
  useEffect(() => {
    if (onTimeUp) {
      onTimeUp(() => guess.map(c => c.noun));
    }
  }, [guess, onTimeUp]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setGuess((items) => {
        const oldIndex = items.findIndex(i => i.noun === active.id);
        const newIndex = items.findIndex(i => i.noun === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div>
      <h2 className="text-cyber text-3xl mb-2">Guess how <span className="font-bold">{targetName}</span> ranked</h2>
      {isTriple && <p className="text-red-400 mb-6">{cycleInfo}</p>}
      
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={guess.map(c => c.noun)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4 mb-8">
            {guess.map((card, index) => (
              <div key={card.noun} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-cyber text-black flex items-center justify-center font-bold">{index + 1}</div>
                <Card card={card} isSpicy={card.isSpicy} />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={() => onSubmit(guess.map(c => c.noun))}
        className="w-full py-4 bg-cyber text-black font-bold text-xl rounded-xl hover:bg-white transition"
      >
        SUBMIT GUESS
      </button>
    </div>
  );
}