'use client';

import { useEffect, useRef, useState } from 'react';

// Total duration: 1500ms fade-in + 2000ms hold + 1500ms fade-out = 5000ms
const FADE_IN_MS  = 1500;
const HOLD_MS     = 2000;
const FADE_OUT_MS = 1500;

export default function MatchSplash({
  targetName,
  onDone,
}: {
  targetName: string;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // Trigger fade-in on next paint
    const t1 = requestAnimationFrame(() => setVisible(true));

    // Begin fade-out after fade-in + hold
    const t2 = setTimeout(() => setVisible(false), FADE_IN_MS + HOLD_MS);

    // Notify parent when animation is fully complete
    const t3 = setTimeout(() => onDoneRef.current(), FADE_IN_MS + HOLD_MS + FADE_OUT_MS);

    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${visible ? FADE_IN_MS : FADE_OUT_MS}ms ease-in-out`,
      }}
    >
      <p className="text-zinc-400 text-sm uppercase tracking-[0.3em] font-semibold mb-4">
        You are matched with
      </p>
      <p className="text-6xl font-bold text-neon drop-shadow-[0_0_24px_rgba(0,255,170,0.5)]">
        {targetName}
      </p>
      <p className="text-zinc-500 text-xs mt-8 uppercase tracking-widest">
        Get ready to rank…
      </p>
    </div>
  );
}
