/* eslint-disable @next/next/no-img-element */
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FULL_PREFETCH } from '@/components/Layout/navigation';

/**
 * `NAVIGATION` less Profile, in the same order. This strip only shows at `md`,
 * where Profile is the avatar button beside it.
 * (Live is a standings tab while a gameweek is in flight, not a destination.)
 */
const navigation = [
  { name: 'Standings', href: '/' },
  { name: 'Results', href: '/results' },
  { name: 'Rumblers', href: '/rumblers' },
  { name: 'Squads', href: '/squads' },
  { name: 'Premier League', href: '/premier-league' },
];

/**
 * The top bar: brand on the left, links from `md` up, profile always.
 *
 * There is deliberately no hamburger here. `MobileNav`'s menu already reaches
 * every destination from the bottom of the screen below `md`, so a second menu
 * up here would be more chrome with nothing new behind it.
 *
 * **Profile is an avatar button on the right**, at every width below `lg`. At
 * `md` it is the only way to Profile; below `md` the phone menu lists it too,
 * and the avatar stays as the conventional place to look for it. At `lg` and
 * up `SideNav` carries it, because this header is hidden there.
 *
 * **It only sticks from `md` up**, where it carries the links. Below that it is
 * a brand mark and nothing else, so pinning it would spend 64px of a phone
 * screen on a logo while `MobileNav` already keeps every destination one thumb
 * away at the bottom. It scrolls away instead — which the profile button can
 * afford in a way the weekly pages could not.
 *
 * The container matches the one in `src/app/layout.tsx` exactly (`max-w-7xl`
 * and the same padding scale) so the brand lines up with the page heading
 * beneath it.
 */
export default function HeaderNav() {
  const pathname = usePathname();
  const isProfile = pathname === '/profile';

  return (
    <header className='z-40 rounded-b-xl bg-gradient-to-t from-[#00edfd] from-10% to-[#75fa95] shadow-lg md:sticky md:top-0 lg:hidden'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex h-16 items-center justify-between'>
          <Link
            href='/'
            className='flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none'
          >
            <img
              className='h-8 w-auto md:h-10'
              src='/better-draft.png'
              alt=''
            />
            <span className='text-lg font-bold tracking-tight text-[#310639] md:text-xl'>
              Better Draft
            </span>
          </Link>

          <div className='flex items-center gap-2'>
            <nav
              aria-label='Primary'
              className='hidden md:flex md:gap-1 lg:hidden'
            >
              {navigation.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    {...FULL_PREFETCH}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
                      isActive
                        ? 'bg-[#310639] text-white'
                        : 'text-[#310639] hover:bg-[#310639]/10'
                    }`}
                  >
                    {link.name}
                    {isActive && (
                      <span className='absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-white/70' />
                    )}
                  </Link>
                );
              })}
            </nav>

            <Link
              href='/profile'
              aria-label='Profile'
              aria-current={isProfile ? 'page' : undefined}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                isProfile
                  ? 'bg-[#310639] text-white'
                  : 'bg-[#310639]/10 text-[#310639] hover:bg-[#310639]/20',
              )}
            >
              <User className='h-5 w-5' />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
