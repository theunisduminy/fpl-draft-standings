/* eslint-disable @next/next/no-img-element */
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navigation = [
  { name: 'Standings', href: '/', target: '_self' },
  { name: 'Matches', href: '/detail', target: '_self' },
  { name: 'Rumblers', href: '/rumblers', target: '_self' },
];

export default function HeaderNav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className='bg-gradient-to-t from-[#00edfd] from-10% to-[#75fa95]'>
      <nav className='mx-auto max-w-7xl px-6 lg:px-8' aria-label='Top'>
        {/* Logo and Desktop Navigation */}
        <div className='flex w-full flex-col items-center justify-between py-6 md:border-b-2 md:border-premPurple'>
          <div className='flex items-center'>
            <Link href='/'>
              <span className='sr-only'>Draft League Standings</span>
              <img
                className='w-40 max-w-screen-lg'
                src='../better-draft.png'
                alt='draft standings logo'
              />
            </Link>
            <div className='ml-12 hidden lg:block'>
              <div className='bg-ruddyBlue flex items-center space-x-2 rounded-xl border-2 border-black px-4 py-2 shadow-[2px_2px_0px_rgba(0,0,0,1)]'>
                {navigation.map((link) => (
                  <Link
                    target={link.target}
                    key={link.name}
                    href={link.href}
                    className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${
                      pathname === link.href
                        ? 'bg-white text-black'
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className='sticky top-0 z-50 lg:hidden'>
          <div className='flex justify-center py-4'>
            <div className='bg-ruddyBlue flex w-full items-center justify-center space-x-3 rounded-xl border-2 border-black p-2 shadow-[2px_2px_0px_rgba(0,0,0,1)]'>
              {navigation.map((link) => (
                <Link
                  target={link.target}
                  key={link.name}
                  href={link.href}
                  className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'bg-white text-black'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
