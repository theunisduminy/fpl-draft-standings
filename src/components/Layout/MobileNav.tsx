'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronUp, Menu } from 'lucide-react';

import { FULL_PREFETCH, NAVIGATION } from '@/components/Layout/navigation';
import { useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { cn } from '@/lib/utils';

/**
 * The phone's navigation: one floating pill at the bottom of every page, below
 * `md`. Ported from Veldboek's `mobile-nav-bar`, less its Filters and Actions
 * buttons, which have nothing to do here.
 *
 *   [ ◉ Current page                 ⌃ ]
 *
 * The pill names where you are, so it doubles as the page's place marker, and
 * opens a card above it listing every destination: the same `NAVIGATION` that
 * `SideNav` draws. It replaced a five-tab bar, which had no room for Profile
 * and had to shorten "Premier League" to "Prem"; the card has room for both.
 *
 * One spacing unit (12px) for the screen edges and the gap between the bar and
 * the card. `AppChrome` pads `<main>` below `md` so the end of a page clears it.
 */

// The bar sits one unit above the safe area, and no higher: a taller floor
// (Veldboek's 1.25rem) left a band of dead page under it. The card's cap keeps
// the top of the page visible above it, so it reads as a card over the page
// rather than a new screen.
const BAR_BOTTOM = 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]';
const CARD_MAX_H =
  'max-h-[calc(100dvh-env(safe-area-inset-bottom)-3.75rem-4.5rem)]';

// Solid surfaces with a cyan edge, not glass. On this near-black purple a
// translucent panel took on the page behind it and vanished into it; the bar
// has to read as the control at a glance. `muted` is the lightest purple in the
// theme, a clear step up from `card` and `background`.
const SURFACE =
  'border border-primary bg-muted text-white shadow-[0_8px_24px_rgba(0,0,0,0.6)]';

// One tempo for everything that opens and closes here (the card, the scrim, the
// chevron): in on the sheet curve, out in half the time on a plain ease-out.
// The exit is the quieter of the two; the reader has already moved on.
const OPEN_MOTION = 'duration-300 ease-sheet';
const CLOSE_MOTION = 'duration-150 ease-out';

// A menu row is a thumb target, not a list line: 48px tall, with 4px between
// rows so each one is its own target and a tap never lands on the seam of two.
// Phone type (`text-base`, 20px icons) rather than `SideNav`'s `text-sm`: the
// rail is read with a cursor, this is hit with a thumb. The corner is concentric
// with the card's: 28px less the card's 8px padding is 20px. A press tints the
// row at once and sinks it slightly (`0.98`, not the pill's `0.96`: a
// full-width row moving 4% reads as a lurch), so the tap is felt before the card
// closes on it.
const MENU_ROW =
  'relative flex h-12 items-center gap-3.5 rounded-[1.25rem] px-3.5 text-base transition-[background-color,scale] duration-150 ease-out active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none';

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const cardId = useId();

  // A navigation closes the card however it happened (a row here, a link in the
  // page, back/forward). Adjusted during render, not in an effect.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  // Out of the way while typing: on Android the bar would ride up on the
  // keyboard and cover the field being filled in.
  const typing = useKeyboardOpen();
  if (typing && open) setOpen(false);

  // The card is a dialog, so Escape closes it. Tab stays within the bar and the
  // card, as the scrim already does for a pointer: the page behind is dimmed,
  // and focus wandering into it would act on something the reader cannot see
  // properly. Not a full trap: the pill stays reachable, so it can close the
  // card again.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !rootRef.current) return;
      const focusable = [
        ...rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter((el) => !el.closest('[inert]'));
      if (focusable.length === 0) return;
      const at = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? at <= 0
          ? focusable.length - 1
          : at - 1
        : at === -1 || at === focusable.length - 1
          ? 0
          : at + 1;
      event.preventDefault();
      focusable[next].focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // A player page belongs to no destination, so the pill falls back to "Menu".
  const current = NAVIGATION.find((link) => link.href === pathname);
  const CurrentIcon = current?.icon ?? Menu;
  const currentLabel = current?.name ?? 'Menu';

  return (
    <div ref={rootRef} className='md:hidden'>
      {/* Dims and blurs the page while the card is open; tapping it closes. */}
      <div
        aria-hidden='true'
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-background/50 backdrop-blur-[2px] transition-opacity motion-reduce:transition-none',
          open
            ? cn('opacity-100', OPEN_MOTION)
            : cn('pointer-events-none opacity-0', CLOSE_MOTION),
        )}
      />

      <nav
        aria-label='Main'
        inert={typing}
        className={cn(
          'fixed inset-x-3 z-50 transition-[opacity,translate] duration-200 motion-reduce:transition-none',
          BAR_BOTTOM,
          typing && 'pointer-events-none translate-y-4 opacity-0',
        )}
      >
        <MenuCard id={cardId} open={open}>
          <ul className='flex flex-col gap-1'>
            {NAVIGATION.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    {...FULL_PREFETCH}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      MENU_ROW,
                      isActive
                        ? 'bg-primary/15 font-semibold text-white'
                        : 'text-white active:bg-white/10',
                    )}
                  >
                    {/* The rail is `SideNav`'s, inside the row rather than
                        outside it: the card's edge is too close to hang it off. */}
                    {isActive && (
                      <span
                        aria-hidden='true'
                        className='absolute top-3 bottom-3 left-0 w-[3px] rounded-full bg-gradient-to-b from-[#00edfd] to-[#75fa95]'
                      />
                    )}
                    <Icon
                      aria-hidden='true'
                      className={cn(
                        'size-5 shrink-0',
                        isActive ? 'text-primary' : 'text-white/70',
                      )}
                      strokeWidth={isActive ? 2 : 1.75}
                    />
                    <span className='truncate'>{link.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </MenuCard>

        <button
          type='button'
          onClick={() => setOpen((was) => !was)}
          aria-expanded={open}
          aria-controls={cardId}
          aria-label={`Menu: ${currentLabel}`}
          className={cn(
            SURFACE,
            'relative flex h-12 w-full items-center gap-2.5 rounded-full ps-2 pe-4 transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:scale-[0.96] motion-reduce:transition-none',
          )}
        >
          <span className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'>
            <CurrentIcon aria-hidden='true' className='size-4' />
          </span>
          <span className='min-w-0 flex-1 truncate text-start text-sm font-semibold'>
            {currentLabel}
          </span>
          <ChevronUp
            aria-hidden='true'
            className={cn(
              'size-4 shrink-0 text-white/80 transition-transform motion-reduce:transition-none',
              open ? cn('rotate-180', OPEN_MOTION) : CLOSE_MOTION,
            )}
          />
        </button>
      </nav>
    </div>
  );
}

/**
 * The card: rises out of the pill and sinks back toward it. 8px of travel and a
 * uniform 0.96 scale from the bottom edge, with the fade running alongside.
 * Uniform, because squashing one axis more than the other distorts the text
 * mid-flight, and alongside, because a fade that lags leaves a shrinking card on
 * screen at full strength. No blur on the motion: filtering a card this size
 * over its own backdrop blur drops frames on a phone. Plain transitions, so a
 * tap mid-flight reverses from where the card is. Reduced motion keeps the fade
 * and drops the travel.
 */
function MenuCard({
  id,
  open,
  children,
}: {
  id: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      role='dialog'
      aria-label='Menu'
      aria-hidden={!open}
      inert={!open}
      className={cn(
        SURFACE,
        'absolute inset-x-0 bottom-[calc(100%+0.75rem)] flex origin-bottom flex-col overflow-hidden rounded-[1.75rem]',
        'transition-[opacity,scale,translate] motion-reduce:transition-opacity',
        CARD_MAX_H,
        open
          ? cn('translate-y-0 scale-100 opacity-100', OPEN_MOTION)
          : cn(
              'pointer-events-none translate-y-2 scale-[0.96] opacity-0 motion-reduce:translate-y-0 motion-reduce:scale-100',
              CLOSE_MOTION,
            ),
      )}
    >
      {/* The rule stops short of the card's edges, as the rows below do. */}
      <div className='mx-2 flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-3'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/better-draft.png' alt='' className='h-7 w-auto' />
        <span className='bg-gradient-to-r from-[#00edfd] to-[#75fa95] bg-clip-text text-base font-bold tracking-tight text-transparent'>
          Better Draft
        </span>
      </div>
      <div className='min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto overscroll-contain p-2 [&::-webkit-scrollbar]:hidden'>
        {children}
      </div>
    </div>
  );
}
