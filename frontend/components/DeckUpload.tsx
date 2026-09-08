'use client';

import { useRef, useState } from 'react';
import {
  DECK_LIMITS,
  SAMPLE_DECK_DOWNLOAD_URL,
  SAMPLE_DECK_VIEW_URL,
  parseAndValidateDeck,
} from '../lib/deckValidation';
import { CardDeck } from '../lib/types';

interface Loaded {
  name: string;
  cardCount: number;
  safeCount: number;
  spicyCount: number;
}

/**
 * Host control for uploading a custom card deck.
 *
 * Validates in the browser before anything is sent, so an author gets specific,
 * per-card problems immediately rather than a generic rejection after a round
 * trip. The server re-validates regardless — this pass is for feedback, not
 * trust.
 */
export default function DeckUpload({
  loaded,
  serverErrors,
  onDeck,
}: {
  /** Summary of the deck currently accepted by the server, if any. */
  loaded: Loaded | null;
  /** Errors returned by the server's own validation pass. */
  serverErrors: string[] | null;
  onDeck: (deck: CardDeck) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setErrors([]);
    setBusy(true);
    try {
      if (file.size > DECK_LIMITS.maxFileBytes) {
        setErrors([
          `That file is ${Math.round(file.size / 1024)} KB. The maximum is ${
            DECK_LIMITS.maxFileBytes / 1024
          } KB.`,
        ]);
        return;
      }

      const text = await file.text();
      const fallbackName = file.name.replace(/\.json$/i, '');
      const result = parseAndValidateDeck(text, fallbackName);

      if (!result.valid || !result.deck) {
        setErrors(result.errors);
        return;
      }

      onDeck(result.deck);
    } catch (err) {
      setErrors([`Could not read that file. ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setBusy(false);
      // Clear the input so picking the same file again still fires a change.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const shown = errors.length > 0 ? errors : (serverErrors ?? []);

  return (
    <div className="mt-4 text-left">
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="px-5 py-2.5 bg-zinc-700 text-zinc-100 font-semibold text-sm rounded-xl border border-zinc-600 hover:border-cyber hover:text-cyber transition disabled:opacity-50"
        >
          {busy ? 'Checking…' : loaded ? 'Replace deck…' : 'Choose deck file…'}
        </button>

        <a
          href={SAMPLE_DECK_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer"
          className="px-5 py-2.5 bg-zinc-800 text-zinc-300 font-semibold text-sm rounded-xl border border-zinc-700 hover:border-neon hover:text-neon transition"
        >
          Download sample deck
        </a>

        <a
          href={SAMPLE_DECK_VIEW_URL}
          target="_blank"
          rel="noreferrer"
          className="text-zinc-400 text-sm underline underline-offset-4 hover:text-cyber transition"
        >
          View format on GitHub
        </a>
      </div>

      {loaded && shown.length === 0 && (
        <div className="mt-4 rounded-xl border border-neon/40 bg-neon/5 px-4 py-3">
          <p className="text-neon text-sm font-semibold">Deck loaded: {loaded.name}</p>
          <p className="text-zinc-400 text-xs mt-1">
            {loaded.cardCount} cards · {loaded.safeCount} standard · {loaded.spicyCount} spicy
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-500/50 bg-red-500/5 px-4 py-3">
          <p className="text-red-300 text-sm font-semibold mb-2">
            {shown.length === 1 ? 'This deck has a problem:' : `This deck has ${shown.length} problems:`}
          </p>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {shown.map((e, i) => (
              <li key={i} className="text-red-200/90 text-xs leading-relaxed">
                • {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loaded && shown.length === 0 && (
        <p className="text-zinc-500 text-xs mt-3 text-center leading-relaxed">
          A JSON file with a <span className="text-zinc-400">name</span> and a{' '}
          <span className="text-zinc-400">cards</span> array. Each card needs a noun, tooltip,
          tooltipMeme, category and isSpicy. At least {DECK_LIMITS.minSafeCards} standard and{' '}
          {DECK_LIMITS.minSpicyCards} spicy cards.
        </p>
      )}
    </div>
  );
}
