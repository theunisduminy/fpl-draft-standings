'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, BarChart3, Beer, Users, Shield, User } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Six here against `MobileNav`'s five: this rail has vertical room, so it
 * carries Profile as well and spells "Premier League" out in full where the
 * bottom bar has to say "Prem".
 */
const navigation = [
  { name: 'Standings', href: '/', icon: Trophy },
  { name: 'Results', href: '/results', icon: BarChart3 },
  { name: 'Rumblers', href: '/rumblers', icon: Beer },
  { name: 'Squads', href: '/squads', icon: Users },
  { name: 'Premier League', href: '/premier-league', icon: Shield },
  { name: 'Profile', href: '/profile', icon: User },
];

/**
 * The desktop navigation: a floating panel, not a flush rail.
 *
 * Hand-rolled rather than taken from the registry, which is a deliberate
 * exception to the "primitives first" rule in FRONTEND.md. shadcn's `sidebar`
 * is ~700 lines built for app shells with groups, submenus, rails and inset
 * modes; it also pulls in the `radix-ui` namespace package and expects the
 * newer generation of `button`/`sheet`/`tooltip`, which would have restyled
 * every button on the site. Five links did not justify that.
 *
 * Below `lg` this is hidden entirely — `MobileNav` and the `HeaderNav` avatar
 * already reach the same five destinations between them, and two mechanisms for
 * one set of links is one too many. This rail keeps Profile in the list that
 * `MobileNav` drops, because from `lg` up the header is hidden and this is the
 * only navigation on the page.
 *
 * **The gradient is the signature, moved.** It used to run across the full
 * width of the top bar, which made the loudest thing on every page a piece of
 * chrome rather than the standings. It now appears in exactly two places: the
 * 3px rail on the active item, and the brand mark. Same colours, a hundredth
 * of the area, and it answers "where am I?" instead of decorating.
 */
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label='Main'
      // `glass-panel` for the same reason as `MobileNav`: the blur goes behind
      // the rail, not on it, so its contents stay out of the composited layer.
      className='glass-panel fixed top-4 bottom-4 left-4 z-40 hidden w-56 flex-col rounded-2xl border border-white/10 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)] lg:flex'
    >
      <Link
        href='/'
        className='mb-4 flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-white/5'
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/better-draft.png' alt='' className='h-8 w-auto' />
        <span className='bg-gradient-to-r from-[#00edfd] to-[#75fa95] bg-clip-text text-base font-bold tracking-tight text-transparent'>
          Better Draft
        </span>
      </Link>

      <ul className='flex flex-1 flex-col gap-1'>
        {navigation.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <li key={link.name}>
              <Link
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white',
                )}
              >
                {isActive && (
                  <span
                    aria-hidden='true'
                    className='absolute top-2 bottom-2 -left-3 w-[3px] rounded-full bg-gradient-to-b from-[#00edfd] to-[#75fa95]'
                  />
                )}
                {/* Solid white when inactive, matching `MobileNav` — see the
                    comment there for why an icon this small cannot carry its
                    hierarchy in opacity. The two navigations are one design; a
                    treatment that only holds on one of them is a drift. */}
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-[#00edfd]' : 'text-white',
                  )}
                />
                {link.name}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className='px-3 pt-3 text-[10px] text-white/25'>Draft Cup · 2026/27</p>
    </nav>
  );
}
