'use client';

import { useEffect, useState } from 'react';
import { LANDING_QUOTES, QUOTE_DURATION_MS } from '../lib/quotes';

// Cross-fade at each end of a quote's turn on screen.
const FADE_MS = 600;

/**
 * Rotates the landing-page quotes, one every QUOTE_DURATION_MS, looping.
 *
 * Reserves a fixed minimum height so the layout underneath does not jump as
 * quotes of very different lengths swap in.
 */
export default function QuoteRotator() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fadeIn = requestAnimationFrame(() => setVisible(true));
    const fadeOut = setTimeout(() => setVisible(false), QUOTE_DURATION_MS - FADE_MS);
    const advance = setTimeout(
      () => setIndex(i => (i + 1) % LANDING_QUOTES.length),
      QUOTE_DURATION_MS
    );
    return () => {
      cancelAnimationFrame(fadeIn);
      clearTimeout(fadeOut);
      clearTimeout(advance);
    };
  }, [index]);

  return (
    <div className="flex items-center justify-center min-h-[4.5rem] px-4">
      <p
        aria-live="polite"
        className="italic text-center text-zinc-400 text-base md:text-lg max-w-2xl leading-relaxed"
        style={{ opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease-in-out` }}
      >
        {LANDING_QUOTES[index]}
      </p>
    </div>
  );
}
