'use client';

import { useEffect, useState } from 'react';
import { INSTRUCTION_SLIDES, SLIDE_DURATION_MS } from '../lib/instructions';

// Cross-fade duration at the start/end of each slide.
const FADE_MS = 700;

/**
 * Cycles through the how-to-play slides, each held for SLIDE_DURATION_MS (8s),
 * fading in and out between them. Loops forever until unmounted.
 *
 * - `inline`    — embedded in the waiting lobby for a joining player.
 * - `presenter` — full-screen, oversized font for the host's screen-share popup.
 */
export default function InstructionsLoop({
  variant = 'inline',
}: {
  variant?: 'inline' | 'presenter';
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade the new slide in on the next frame.
    const fadeIn = requestAnimationFrame(() => setVisible(true));
    // Start fading out shortly before we swap to the next slide.
    const fadeOut = setTimeout(() => setVisible(false), SLIDE_DURATION_MS - FADE_MS);
    // Advance to the next slide (wrapping around).
    const advance = setTimeout(
      () => setIndex((i) => (i + 1) % INSTRUCTION_SLIDES.length),
      SLIDE_DURATION_MS
    );
    return () => {
      cancelAnimationFrame(fadeIn);
      clearTimeout(fadeOut);
      clearTimeout(advance);
    };
  }, [index]);

  const slide = INSTRUCTION_SLIDES[index];
  const presenter = variant === 'presenter';

  return (
    <div
      className={
        presenter
          ? 'fixed inset-0 flex flex-col items-center justify-center bg-black px-10 text-center'
          : 'flex flex-col items-center justify-center text-center py-4'
      }
    >
      <div
        style={{ opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease-in-out` }}
        className="flex flex-col items-center"
      >
        <div className={presenter ? 'text-9xl mb-8' : 'text-6xl mb-4'}>{slide.emoji}</div>
        <h2
          className={
            presenter
              ? 'text-6xl md:text-7xl font-extrabold text-neon mb-8 drop-shadow-[0_0_24px_rgba(0,255,170,0.4)]'
              : 'text-2xl font-bold text-neon mb-3'
          }
        >
          {slide.title}
        </h2>
        <p
          className={
            presenter
              ? 'text-3xl md:text-4xl text-white max-w-5xl leading-relaxed'
              : 'text-base text-zinc-300 max-w-md leading-relaxed'
          }
        >
          {slide.body}
        </p>
      </div>

      {/* Progress dots — highlight the current slide */}
      <div className={`flex items-center ${presenter ? 'gap-3 mt-16' : 'gap-2 mt-6'}`}>
        {INSTRUCTION_SLIDES.map((_, i) => (
          <span
            key={i}
            className={`rounded-full transition-all duration-500 ${
              presenter ? 'h-3' : 'h-2'
            } ${
              i === index
                ? presenter
                  ? 'w-12 bg-neon'
                  : 'w-6 bg-neon'
                : presenter
                  ? 'w-3 bg-zinc-700'
                  : 'w-2 bg-zinc-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
