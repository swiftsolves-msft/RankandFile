// Client-side deck parsing and validation.
//
// These rules mirror DeckValidator.cs on the server. The duplication is
// deliberate: the browser copy exists so an author sees precise, line-level
// problems the instant they pick a file, while the server copy is the one that
// actually decides. Keep the constants below in step with the C# ones.

import { Card, CardDeck } from './types';

export const DECK_LIMITS = {
  maxCards: 100,
  maxNameLength: 80,
  maxDescriptionLength: 200,
  maxNounLength: 60,
  maxTooltipLength: 300,
  // A round deals 4 safe + 1 spicy, or 3 safe + 2 spicy — a thinner deck cannot
  // fill a hand, so it is rejected here rather than failing mid-session.
  minSafeCards: 4,
  minSpicyCards: 2,
  maxFileBytes: 512 * 1024,
} as const;

/** Where authors can browse worked examples to copy, including future decks. */
export const SAMPLE_DECKS_URL = 'https://github.com/swiftsolves-msft/RankandFile/tree/main/decks';

export interface DeckValidation {
  valid: boolean;
  errors: string[];
  deck: CardDeck | null;
  safeCount: number;
  spicyCount: number;
}

function fail(...errors: string[]): DeckValidation {
  return { valid: false, errors, deck: null, safeCount: 0, spicyCount: 0 };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function label(noun: unknown): string {
  if (typeof noun !== 'string' || noun.trim() === '') return '?';
  return noun.length <= 30 ? noun : `${noun.slice(0, 30)}...`;
}

/**
 * Parses and validates a deck file.
 *
 * Accepts either the documented shape `{ name, description?, cards: [...] }` or
 * a bare array of cards, since hand-written decks often start life as just a
 * list. `fallbackName` is used to name a bare-array deck (typically the filename).
 */
export function parseAndValidateDeck(text: string, fallbackName = 'Custom Deck'): DeckValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`This file is not valid JSON. ${message}`);
  }

  let name: unknown;
  let description: unknown;
  let rawCards: unknown;

  if (Array.isArray(parsed)) {
    name = fallbackName;
    rawCards = parsed;
  } else if (isObject(parsed)) {
    name = parsed.name;
    description = parsed.description;
    rawCards = parsed.cards;
  } else {
    return fail('Expected a JSON object with a "cards" array, or a bare array of cards.');
  }

  const errors: string[] = [];

  if (typeof name !== 'string' || name.trim() === '') {
    errors.push('"name" is required and cannot be blank.');
  } else if (name.length > DECK_LIMITS.maxNameLength) {
    errors.push(`"name" must be ${DECK_LIMITS.maxNameLength} characters or fewer.`);
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      errors.push('"description" must be text.');
    } else if (description.length > DECK_LIMITS.maxDescriptionLength) {
      errors.push(`"description" must be ${DECK_LIMITS.maxDescriptionLength} characters or fewer.`);
    }
  }

  if (!Array.isArray(rawCards) || rawCards.length === 0) {
    errors.push('"cards" is required and must contain at least one card.');
    return { valid: false, errors, deck: null, safeCount: 0, spicyCount: 0 };
  }

  if (rawCards.length > DECK_LIMITS.maxCards) {
    errors.push(`Deck has ${rawCards.length} cards; the maximum is ${DECK_LIMITS.maxCards}.`);
  }

  const cards: Card[] = [];
  const seen = new Set<string>();

  rawCards.forEach((raw, i) => {
    const where = `Card ${i + 1}`;

    if (!isObject(raw)) {
      errors.push(`${where} is not an object.`);
      return;
    }

    const { noun, tooltip, tooltipMeme, category, isSpicy } = raw;

    if (typeof noun !== 'string' || noun.trim() === '') {
      errors.push(`${where}: "noun" is required.`);
    } else {
      if (noun.length > DECK_LIMITS.maxNounLength) {
        errors.push(`${where} ("${label(noun)}"): "noun" must be ${DECK_LIMITS.maxNounLength} characters or fewer.`);
      }
      // Nouns key the rankings, so a duplicate could be dealt twice into one
      // hand and corrupt that round's scoring.
      const key = noun.trim().toLowerCase();
      if (seen.has(key)) {
        errors.push(`${where}: duplicate noun "${label(noun)}". Every noun must be unique.`);
      }
      seen.add(key);
    }

    if (typeof tooltip !== 'string' || tooltip.trim() === '') {
      errors.push(`${where} ("${label(noun)}"): "tooltip" is required.`);
    } else if (tooltip.length > DECK_LIMITS.maxTooltipLength) {
      errors.push(`${where} ("${label(noun)}"): "tooltip" must be ${DECK_LIMITS.maxTooltipLength} characters or fewer.`);
    }

    if (typeof tooltipMeme !== 'string' || tooltipMeme.trim() === '') {
      errors.push(`${where} ("${label(noun)}"): "tooltipMeme" is required. It is shown when the host picks Meme card mode.`);
    } else if (tooltipMeme.length > DECK_LIMITS.maxTooltipLength) {
      errors.push(`${where} ("${label(noun)}"): "tooltipMeme" must be ${DECK_LIMITS.maxTooltipLength} characters or fewer.`);
    }

    if (typeof category !== 'string' || category.trim() === '') {
      errors.push(`${where} ("${label(noun)}"): "category" is required.`);
    }

    if (isSpicy !== undefined && typeof isSpicy !== 'boolean') {
      errors.push(`${where} ("${label(noun)}"): "isSpicy" must be true or false.`);
    }

    cards.push({
      noun: typeof noun === 'string' ? noun.trim() : '',
      tooltip: typeof tooltip === 'string' ? tooltip.trim() : '',
      tooltipMeme: typeof tooltipMeme === 'string' ? tooltipMeme.trim() : '',
      category: typeof category === 'string' ? category.trim() : '',
      isSpicy: isSpicy === true,
    });
  });

  const safeCount = cards.filter(c => !c.isSpicy).length;
  const spicyCount = cards.filter(c => c.isSpicy).length;

  if (safeCount < DECK_LIMITS.minSafeCards) {
    errors.push(`Deck needs at least ${DECK_LIMITS.minSafeCards} cards with "isSpicy": false (found ${safeCount}).`);
  }
  if (spicyCount < DECK_LIMITS.minSpicyCards) {
    errors.push(`Deck needs at least ${DECK_LIMITS.minSpicyCards} cards with "isSpicy": true (found ${spicyCount}).`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, deck: null, safeCount, spicyCount };
  }

  return {
    valid: true,
    errors: [],
    deck: {
      name: (name as string).trim(),
      description: typeof description === 'string' ? description.trim() : undefined,
      cards,
    },
    safeCount,
    spicyCount,
  };
}
