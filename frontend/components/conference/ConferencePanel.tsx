'use client';

import { ReactNode } from 'react';

/**
 * Shared shell for the Conference result dashboards so all four squares share
 * one header rhythm and sit on an even grid.
 *
 * `scale` bumps every size up for the presenter pop-out, where a panel is read
 * from the back of a room rather than from a laptop.
 */
export default function ConferencePanel({
  title,
  subtitle,
  footnote,
  scale = 'normal',
  children,
}: {
  title: string;
  subtitle?: string;
  footnote?: ReactNode;
  scale?: 'normal' | 'large';
  children: ReactNode;
}) {
  const large = scale === 'large';

  return (
    <div
      className={`bg-zinc-900 border border-zinc-700 rounded-2xl flex flex-col ${
        large ? 'p-8' : 'p-5'
      }`}
    >
      <p
        className={`text-zinc-300 font-semibold uppercase tracking-widest ${
          large ? 'text-xl' : 'text-xs'
        }`}
      >
        {title}
      </p>
      {subtitle && (
        <p className={`text-zinc-500 mt-1 ${large ? 'text-base' : 'text-[11px]'}`}>{subtitle}</p>
      )}

      <div className={large ? 'mt-6 flex-1' : 'mt-3 flex-1'}>{children}</div>

      {footnote && (
        <div
          className={`border-t border-zinc-800 text-zinc-500 ${
            large ? 'mt-6 pt-4 text-base' : 'mt-3 pt-2 text-[11px]'
          }`}
        >
          {footnote}
        </div>
      )}
    </div>
  );
}
