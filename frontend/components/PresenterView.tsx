'use client';

import { useEffect, useState } from 'react';
import InstructionsLoop from './InstructionsLoop';
import { onPresenterGameStarted } from '../lib/presenter';

/**
 * Full-screen instructions view opened by the host in a separate window for
 * screen sharing (Teams / Webex / a projector at an event). It loops the
 * how-to-play slides until the host starts the game, at which point it shows a
 * brief "game has started" message and stops.
 */
export default function PresenterView() {
  const [started, setStarted] = useState(false);

  useEffect(() => onPresenterGameStarted(() => setStarted(true)), []);

  if (started) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black px-10 text-center">
        <div className="text-9xl mb-8">🎮</div>
        <h2 className="text-6xl md:text-7xl font-extrabold text-neon mb-6 drop-shadow-[0_0_24px_rgba(0,255,170,0.4)]">
          The game has started!
        </h2>
        <p className="text-3xl md:text-4xl text-zinc-300">Follow along on the main screen.</p>
      </div>
    );
  }

  return <InstructionsLoop variant="presenter" />;
}
