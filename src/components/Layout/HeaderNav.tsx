/* eslint-disable @next/next/no-img-element */
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';

import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Standings', href: '/' },
  { name: 'Results', href: '/results' },
  { name: 'Rumblers', href: '/rumblers' },
  { name: 'Squads', href: '/squads' },
];

/**
 * The top bar: brand on the left, links from `md` up, profile always.
 *
 * There is deliberately no mobile menu here. `MobileNav` already puts every
 * destination in a fixed bottom bar below `md`, so a hamburger would be a
 * second way to reach the same links — more chrome, nothing new behind it.
 *
 * **Profile lives here rather than in the bottom bar.** It is a destination
 * people open twice a season, and a bottom bar comfortably holds about five
 * items; spending one of those on the profile crowds out the pages that get
 * opened every gameweek. It is an avatar button on the right instead, present
 * at every width below `lg` — at `lg` and up `SideNav` carries it, because
 * this header is hidden there and nothing else would.
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
          <Link href='/' className='flex items-center gap-2.5'>
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
            <nav className='hidden md:flex md:gap-1 lg:hidden'>
              {navigation.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#310639] text-white'
                        : 'text-[#310639] hover:bg-[#310639]/10'
                    }`}
                  >
                    {link.name}
                    {isActive && (
                      <span className='absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[#310639]' />
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
                'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
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
