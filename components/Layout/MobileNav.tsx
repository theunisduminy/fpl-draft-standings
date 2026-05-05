'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, BarChart3, Beer } from 'lucide-react';

const navigation = [
  { name: 'Standings', href: '/', icon: Trophy },
  { name: 'Results', href: '/results', icon: BarChart3 },
  { name: 'Rumblers', href: '/rumblers', icon: Beer },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className='fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-gradient-to-t from-[#00edfd] from-10% to-[#75fa95] shadow-[0_-4px_20px_rgba(0,0,0,0.3)] md:hidden'>
      <div className='mx-auto flex h-16 max-w-md justify-around'>
        {navigation.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? 'text-[#310639]'
                  : 'text-[#310639]/60 hover:text-[#310639]/90'
              }`}
            >
              <Icon className='h-5 w-5' />
              <span className='text-[10px] font-semibold'>{link.name}</span>
              {isActive && (
                <span className='absolute bottom-1 h-1 w-8 rounded-full bg-[#310639]' />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
