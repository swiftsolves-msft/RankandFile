'use client';

/**
 * The ZeroRank wordmark.
 *
 * An original treatment drawn in the early-80s tech/metal idiom: heavy
 * geometric sans, hard forward lean, tracking pulled tight so the letters nearly
 * collide, finished with a chrome gradient and a neon bloom to sit inside the
 * game's existing palette. It evokes the period styling only — it is not a copy
 * of any company's mark.
 *
 * Built from a system font stack rather than a webfont on purpose: the title is
 * the first thing painted, and a network round-trip for a display face would
 * either block it or flash unstyled text.
 */
export default function ZeroRankTitle({
  size = 'normal',
}: {
  size?: 'normal' | 'large';
}) {
  const large = size === 'large';

  return (
    <div className="flex items-center justify-center select-none">
      {/* Leading accent bar, sheared to match the wordmark's lean */}
      <span
        aria-hidden="true"
        className={`bg-neon shrink-0 ${large ? 'h-16 w-2 mr-4' : 'h-10 w-1.5 mr-2.5'}`}
        style={{ transform: 'skewX(-12deg)' }}
      />

      <h1
        className={`font-black leading-none tracking-tighter ${
          large ? 'text-7xl md:text-8xl' : 'text-5xl md:text-6xl'
        }`}
        style={{
          fontFamily: "'Arial Black', 'Arial Bold', 'Helvetica Neue', Impact, sans-serif",
          letterSpacing: '-0.045em',
          transform: 'skewX(-12deg)',
          backgroundImage:
            'linear-gradient(180deg, #ffffff 0%, #e2e2e2 34%, #8a8a8a 49%, #4f4f4f 51%, #c9c9c9 66%, #ffffff 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          // drop-shadow rather than text-shadow: a clipped-background title has
          // no painted glyph colour for text-shadow to key off.
          filter: 'drop-shadow(0 0 18px rgba(0, 255, 157, 0.35))',
        }}
      >
        ZERORANK
      </h1>

      <span
        aria-hidden="true"
        className={`bg-cyber shrink-0 ${large ? 'h-16 w-2 ml-4' : 'h-10 w-1.5 ml-2.5'}`}
        style={{ transform: 'skewX(-12deg)' }}
      />
    </div>
  );
}
