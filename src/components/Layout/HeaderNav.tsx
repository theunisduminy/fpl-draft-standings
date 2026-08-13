/* eslint-disable @next/next/no-img-element */
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Standings', href: '/' },
  { name: 'Results', href: '/results' },
  { name: 'Rumblers', href: '/rumblers' },
  { name: 'Squads', href: '/squads' },
  { name: 'Profile', href: '/profile' },
];

/**
 * The top bar: brand on the left, links on the right from `md` up.
 *
 * There is deliberately no mobile menu here. `MobileNav` already puts every
 * destination in a fixed bottom bar below `md`, so a hamburger would be a
 * second way to reach the same five links — more chrome, nothing new behind it.
 *
 * The container matches the one in `src/app/layout.tsx` exactly (`max-w-7xl`
 * and the same padding scale) so the brand lines up with the page heading
 * beneath it.
 */
export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <header className='sticky top-0 z-40 rounded-b-xl bg-gradient-to-t from-[#00edfd] from-10% to-[#75fa95] shadow-lg'>
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

          <nav className='hidden md:flex md:gap-1'>
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
        </div>
      </div>
    </header>
  );
}
