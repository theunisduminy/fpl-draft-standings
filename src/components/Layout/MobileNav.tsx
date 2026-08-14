'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, BarChart3, Beer, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Standings', href: '/', icon: Trophy },
  { name: 'Results', href: '/results', icon: BarChart3 },
  { name: 'Rumblers', href: '/rumblers', icon: Beer },
  { name: 'Squads', href: '/squads', icon: Users },
];

/**
 * The mobile navigation: `SideNav`, laid on its side.
 *
 * Same `glass` treatment and hairline border, and the gradient appears only on
 * the active item — a 3px rail and a cyan icon — so the loudest thing on a
 * phone screen is the standings rather than the chrome. The two navigations are
 * one design at two orientations; change the styling of one and change the
 * other.
 *
 * **Their contents deliberately differ by one item.** Profile is not here: a
 * bottom bar holds about five items before the labels start to crowd, and this
 * one has to keep room for the weekly pages. It moved to the avatar button in
 * `HeaderNav`, which is on screen at every width this bar is. `SideNav` still
 * lists it, because from `lg` up that rail is the only navigation there is.
 *
 * It floats at the sides like `SideNav` does, with a 0.25rem gap beneath it —
 * enough to read as floating, too little to show a strip of page. There is
 * deliberately no `safe-area-inset-bottom` offset; that gap plus the panel's
 * own 0.375rem of padding is what the iOS home indicator gets. `AppChrome`
 * pads `<main>` below `md` to match — a fixed bar hides the end of the page
 * otherwise.
 */
export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label='Main'
      className='glass fixed right-3 bottom-1 left-3 z-50 rounded-2xl border border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.4)] md:hidden'
    >
      <ul className='mx-auto flex h-16 max-w-md items-stretch justify-around p-1.5'>
        {navigation.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <li key={link.name} className='flex flex-1'>
              <Link
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-colors',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white',
                )}
              >
                {isActive && (
                  <span
                    aria-hidden='true'
                    className='absolute inset-x-3 bottom-1 h-[3px] rounded-full bg-gradient-to-r from-[#00edfd] to-[#75fa95]'
                  />
                )}
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    isActive ? 'text-[#00edfd]' : 'text-white/40',
                  )}
                />
                <span className='text-[10px] font-semibold'>{link.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
