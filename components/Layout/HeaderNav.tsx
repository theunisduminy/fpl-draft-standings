/* eslint-disable @next/next/no-img-element */

'use client';
import Link from 'next/link';

const navigation = [
  { name: 'Standings', href: '/', target: '_self' },
  { name: 'Matches', href: '/detail', target: '_self' },
  { name: 'Rumblers', href: '/rumblers', target: '_self' },
];

export default function HeaderNav() {
  return (
    <header className='bg-gradient-to-t from-[#00edfd] from-10% to-[#75fa95]'>
      {/* <header className='bg-[#75fa95]'> */}
      <nav className='mx-auto max-w-7xl px-6 lg:px-8' aria-label='Top'>
        <div className='flex w-full flex-col items-center justify-between border-b-2 border-premPurple py-6'>
          <div className='flex items-center'>
            <Link href='/'>
              <span className='sr-only'>Draft League Standings</span>
              <img
                className='w-40 max-w-screen-lg'
                src='../better-draft.png'
                alt='draft standings logo'
              />
            </Link>
            <div className='ml-10 hidden space-x-6 lg:block'>
              {navigation.map((link) => (
                <a
                  target={link.target}
                  key={link.name}
                  href={link.href}
                  className='text-md rounded-lg border border-premPurple px-4 py-2 font-medium text-premPurple hover:bg-premPurple hover:text-indigo-50'
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className='sticky top-0 z-20 flex flex-wrap justify-center gap-x-2 py-4 lg:hidden'>
          {navigation.map((link) => (
            <a
              target={link.target}
              key={link.name}
              href={link.href}
              className='rounded-lg border border-premPurple px-4 py-2 text-sm font-medium text-premPurple hover:bg-premPurple hover:text-indigo-50'
            >
              {link.name}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
