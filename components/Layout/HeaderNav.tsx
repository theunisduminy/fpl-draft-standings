/* eslint-disable @next/next/no-img-element */
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Standings', href: '/', target: '_self' },
  { name: 'Results', href: '/results', target: '_self' },
  { name: 'Rumblers', href: '/rumblers', target: '_self' },
];

export default function HeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <header className='sticky top-0 z-40 rounded-b-xl bg-gradient-to-t from-[#00edfd] from-10% to-[#75fa95] shadow-lg'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex h-16 items-center justify-between'>
          {/* Logo */}
          <Link href='/' className='flex items-center gap-2'>
            <span className='sr-only'>Draft League Standings</span>
            <img
              className='h-8 w-auto md:h-10'
              src='/better-draft.png'
              alt='draft standings logo'
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className='hidden md:flex md:gap-1'>
            {navigation.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
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

          {/* Mobile Menu Sheet */}
          <div className='md:hidden'>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='text-[#310639] hover:bg-[#310639]/10'
                >
                  <Menu className='h-6 w-6' />
                  <span className='sr-only'>Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side='right'
                className='w-[280px] border-white/10 bg-[#1a0520]'
              >
                <nav className='flex flex-col gap-2 pt-8'>
                  {navigation.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.name}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className={`rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-[#00edfd]/20 text-[#00edfd]'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {link.name}
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
