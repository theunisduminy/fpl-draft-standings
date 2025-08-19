/* eslint-disable @next/next/no-img-element */
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import * as React from 'react';
import { MenuIcon, X } from 'lucide-react';

const navigation = [
  { name: 'Standings', href: '/', target: '_self' },
  { name: 'Results', href: '/results', target: '_self' },
  { name: 'Rumblers', href: '/rumblers', target: '_self' },
];

export default function HeaderNav() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className='bg-gradient-to-t from-[#00edfd] from-10% to-[#75fa95]'>
      <nav className='mx-auto max-w-7xl px-6 lg:px-8' aria-label='Top'>
        {/* Logo and Menu Button */}
        <div className='flex w-full flex-row items-center justify-between py-6 md:justify-evenly'>
          <Link href='/' onClick={closeMenu}>
            <span className='sr-only'>Draft League Standings</span>
            <img
              className='w-40 max-w-screen-lg'
              src='../better-draft.png'
              alt='draft standings logo'
            />
          </Link>

          {/* Menu Toggle Button */}
          <button
            onClick={toggleMenu}
            className='flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-premPurple transition-colors hover:bg-premPurple/10 focus:outline-none focus:ring-2 focus:ring-premPurple/20'
            aria-expanded={isMenuOpen}
            aria-label='Toggle navigation menu'
          >
            {isMenuOpen ? (
              <X className='h-5 w-5' />
            ) : (
              <MenuIcon className='h-5 w-5' />
            )}
            <span className='hidden sm:block'>
              {isMenuOpen ? 'Close' : 'Menu'}
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className='border-b-2 border-premPurple'></div>

        {/* Collapsible Menu */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className='py-4'>
            <ul className='flex flex-col space-y-2 sm:flex-row sm:justify-center sm:space-x-6 sm:space-y-0'>
              {navigation.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className={`block rounded-lg px-4 py-3 text-center font-medium transition-colors sm:px-3 sm:py-2 ${
                      pathname === link.href
                        ? 'bg-premPurple text-white'
                        : 'text-premPurple hover:bg-premPurple/10 hover:text-premPurple'
                    }`}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}
