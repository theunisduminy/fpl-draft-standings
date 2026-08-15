'use client';
import { useEffect, useRef } from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface GameweekSelectorProps {
  gameweeks: number[];
  selectedGameweek: number;
  onSelectGameweek: (gameweek: number) => void;
}

/**
 * A row of gameweek pills. Deliberately unlabelled: a strip of "GW 1, GW 2 …"
 * with one highlighted explains itself, and the label was stealing a line of
 * vertical space above the fold on mobile.
 *
 * **The selected pill is scrolled into view.** Without it a strip that opens on
 * anything past the first few gameweeks opens on a highlight nobody can see —
 * the strip looks like it starts at GW 1 and the selection appears to have been
 * lost. It matters most on the Premier League page, which has all 38 from the
 * first day of the season, but the results and rumblers strips grow into the
 * same problem by about November.
 */
export function GameweekSelector({
  gameweeks,
  selectedGameweek,
  onSelectGameweek,
}: GameweekSelectorProps) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  // The first pass is the initial paint, which must not animate: a strip that
  // slides into position on arrival reads as the page still loading. Every
  // pass after it is a click, where the movement is the feedback.
  const hasScrolled = useRef(false);

  useEffect(() => {
    const pill = selectedRef.current;

    if (!pill) return;

    // Radix scrolls its own viewport, not the `ScrollArea` root, so the
    // element that owns `scrollLeft` has to be found rather than assumed.
    const viewport = pill.closest<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    );

    if (!viewport) return;

    // Measured from the rendered boxes rather than `offsetLeft`, which is
    // relative to whichever ancestor happens to be positioned — here the
    // `ScrollArea` root, and that is a coincidence of the primitive's styling
    // rather than something this component should depend on.
    const pillBox = pill.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    const centred =
      pillBox.left - viewportBox.left - (viewportBox.width - pillBox.width) / 2;

    // Nothing to do when the pill is already fully in view: scrolling a strip
    // that did not need it turns every click into a small lurch.
    const fullyVisible =
      pillBox.left >= viewportBox.left && pillBox.right <= viewportBox.right;

    if (fullyVisible && hasScrolled.current) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    viewport.scrollTo({
      left: viewport.scrollLeft + centred,
      behavior: hasScrolled.current && !reduceMotion ? 'smooth' : 'auto',
    });

    hasScrolled.current = true;
  }, [selectedGameweek]);

  return (
    <div className='w-full'>
      <ScrollArea className='w-full rounded-lg whitespace-nowrap'>
        <ToggleGroup
          type='single'
          aria-label='Gameweek'
          value={String(selectedGameweek)}
          onValueChange={(value) => {
            if (value) onSelectGameweek(Number(value));
          }}
          className='flex w-full justify-start gap-1.5 pb-2'
        >
          {gameweeks.map((gameweek) => (
            <ToggleGroupItem
              key={gameweek}
              ref={gameweek === selectedGameweek ? selectedRef : undefined}
              value={String(gameweek)}
              className='min-w-[70px] rounded-lg border border-white/20 bg-[#2a0d33] px-3 py-2 text-xs font-semibold text-white transition-all hover:border-[#00edfd]/50 hover:bg-[#3d1a4d] hover:text-[#00edfd] data-[state=on]:border-[#00edfd] data-[state=on]:bg-[#00edfd]/20 data-[state=on]:text-[#00edfd] md:text-sm'
            >
              GW {gameweek}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ScrollBar orientation='horizontal' className='h-1.5' />
      </ScrollArea>
    </div>
  );
}
