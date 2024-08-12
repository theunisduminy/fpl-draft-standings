/* eslint-disable @next/next/no-img-element */

'use client';
import Link from 'next/link';

const navigation = [
  { name: 'Standings', href: '/', target: '_self' },
  { name: 'Matches', href: '/detail', target: '_self' },
  { name: 'Go to draft', href: 'https://draft.premierleague.com/team/my', target: '_blank' },
];

export default function HeaderNav() {
  return (
    <header className='bg-gradient-to-t from-[#00edfd] to-[#75fa95]'>
      <nav className='mx-auto max-w-7xl px-6 lg:px-8' aria-label='Top'>
        <div className='flex flex-col w-full items-center justify-between border-b-2 border-premPurple py-6'>
          <div className='flex items-center'>
            <Link href='/'>
              <span className='sr-only'>Draft League Standings</span>
              <img
                className='max-w-screen-lg w-40'
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
                  className='text-md font-medium text-premPurple hover:text-indigo-50 hover:bg-premPurple border-2 border-premPurple px-4 py-2 rounded-2xl'
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className='flex flex-wrap justify-center gap-x-2 py-4 sticky top-0 z-20  lg:hidden'>
          {navigation.map((link) => (
            <a
              target={link.target}
              key={link.name}
              href={link.href}
              className='text-sm font-medium text-premPurple hover:text-indigo-50 hover:bg-premPurple border-2 border-premPurple px-4 py-2 rounded-2xl'
            >
              {link.name}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
