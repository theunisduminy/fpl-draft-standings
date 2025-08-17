/* eslint-disable @next/next/no-img-element */
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import * as React from 'react';
import {
  CircleCheckIcon,
  CircleHelpIcon,
  CircleIcon,
  MenuIcon,
} from 'lucide-react';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';

const navigation = [
  { name: 'Standings', href: '/', target: '_self' },
  { name: 'Matches', href: '/detail', target: '_self' },
  { name: 'Rumblers', href: '/rumblers', target: '_self' },
];

export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <header className='bg-gradient-to-t from-[#00edfd] from-10% to-[#75fa95]'>
      <nav className='mx-auto max-w-7xl px-6 lg:px-8' aria-label='Top'>
        {/* Logo and Desktop Navigation */}
        <div className='flex w-full flex-row items-center justify-between py-6 md:justify-evenly md:border-b-2 md:border-premPurple'>
          <Link href='/'>
            <span className='sr-only'>Draft League Standings</span>
            <img
              className='w-40 max-w-screen-lg'
              src='../better-draft.png'
              alt='draft standings logo'
            />
          </Link>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>
                  <MenuIcon className='h-5 w-5 pr-1' />
                  Menu
                </NavigationMenuTrigger>
                <NavigationMenuContent className='p-2'>
                  <ul className='grid w-[200px] gap-2'>
                    {navigation.map((link) => (
                      <ListItem
                        key={link.name}
                        href={link.href}
                        title={link.name}
                      />
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </nav>
    </header>
  );
}

function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<'li'> & { href: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link href={href}>
          <div className='rounded-lg p-2 text-sm font-medium leading-none hover:bg-premPurple hover:text-white'>
            {title}
          </div>
          <p className='line-clamp-2 text-sm leading-snug text-muted-foreground'>
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}
