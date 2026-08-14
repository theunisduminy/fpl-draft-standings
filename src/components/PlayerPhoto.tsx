'use client';

import { useState } from 'react';

import { playerPhotoUrl } from '@/utils/pl-assets';
import type { ElementCode } from '@/interfaces/fpl';
import { cn } from '@/lib/utils';

/**
 * A footballer's headshot, with the fallback it needs.
 *
 * The asset host answers an unknown code with a **403**, not a placeholder, and
 * a new signing has a squad entry days before they have a photo. So this holds
 * a failed load in state and draws initials instead — a broken-image glyph in
 * fifteen rows looks like the page is broken, which it is not.
 *
 * A plain `<img>` rather than `next/image`: 40×40 is already the smallest size
 * the host serves, so there is nothing for the optimiser to do but add a hop.
 */
export function PlayerPhoto({
  code,
  name,
  className,
}: {
  /** Null when the element could not be resolved against the bootstrap. */
  code: ElementCode | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const shape = cn(
    'h-8 w-8 shrink-0 rounded-full bg-white/5 object-cover',
    className,
  );

  if (code === null || failed) {
    return (
      <span
        className={cn(
          shape,
          'flex items-center justify-center text-[10px] font-bold text-white/40',
        )}
        aria-hidden
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={playerPhotoUrl(code)}
      alt=''
      aria-hidden
      width={32}
      height={32}
      loading='lazy'
      onError={() => setFailed(true)}
      className={shape}
    />
  );
}

/** Up to two letters, from a `web_name` that may be one word or three. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
