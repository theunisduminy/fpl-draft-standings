// components/GameweekSelector.tsx
'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

interface GameweekSelectorProps {
  gameweeks: number[];
  selectedGameweek: number;
  onSelectGameweek: (gameweek: number) => void;
  label?: string;
}

export function GameweekSelector({
  gameweeks,
  selectedGameweek,
  onSelectGameweek,
  label = 'Select Gameweek',
}: GameweekSelectorProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (containerRef.current) {
      const newPosition = Math.max(0, scrollPosition - 250);
      containerRef.current.scrollTo({
        left: newPosition,
        behavior: 'smooth',
      });
      setScrollPosition(newPosition);
    }
  };

  const scrollRight = () => {
    if (containerRef.current) {
      const maxScroll =
        containerRef.current.scrollWidth - containerRef.current.clientWidth;
      const newPosition = Math.min(maxScroll, scrollPosition + 250);
      containerRef.current.scrollTo({
        left: newPosition,
        behavior: 'smooth',
      });
      setScrollPosition(newPosition);
    }
  };

  useEffect(() => {
    // Find the index of the selected gameweek
    const selectedIndex = gameweeks.findIndex((gw) => gw === selectedGameweek);
    if (selectedIndex !== -1 && containerRef.current) {
      // Calculate position to center the selected item
      const gwItem = containerRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (gwItem) {
        const containerWidth = containerRef.current.clientWidth;
        const itemPosition = gwItem.offsetLeft;
        const itemWidth = gwItem.offsetWidth;

        // Center the item in the viewport
        const newScrollPosition =
          itemPosition - containerWidth / 2 + itemWidth / 2;
        containerRef.current.scrollTo({
          left: Math.max(0, newScrollPosition),
          behavior: 'smooth',
        });
        setScrollPosition(Math.max(0, newScrollPosition));
      }
    }
  }, [selectedGameweek, gameweeks]);

  return (
    <div className='w-full space-y-2'>
      <h2 className='text-lg font-medium text-[#310639]'>{label}</h2>
      <div className='relative'>
        <button
          onClick={scrollLeft}
          className='absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-premPurple p-1 text-white shadow-md transition-all hover:bg-opacity-90 disabled:opacity-50'
          disabled={scrollPosition <= 0}
          aria-label='Scroll left'
        >
          <ChevronLeft className='h-5 w-5' />
        </button>

        <div
          ref={containerRef}
          className='hide-scrollbar flex overflow-x-auto scroll-smooth py-2'
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div className='pl-8' /> {/* Left padding for scroll button */}
          {gameweeks.map((gameweek) => (
            <button
              key={gameweek}
              onClick={() => onSelectGameweek(gameweek)}
              className={`mx-1 min-w-[90px] rounded-xl border-2 border-premPurple px-4 py-2 text-center font-medium shadow-md transition-all ${
                selectedGameweek === gameweek
                  ? 'bg-gradient-to-r from-cyan-600 to-ruddyBlue text-white'
                  : 'bg-gradient-to-r from-premTurquoise to-premGreen hover:from-premGreen hover:to-premTurquoise'
              } `}
            >
              {gameweek === 0 ? 'All' : `GW ${gameweek}`}
            </button>
          ))}
          <div className='pr-8' /> {/* Right padding for scroll button */}
        </div>

        <button
          onClick={scrollRight}
          className='absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-premPurple p-1 text-white shadow-md transition-all hover:bg-opacity-90 disabled:opacity-50'
          disabled={
            containerRef.current
              ? scrollPosition >=
                containerRef.current.scrollWidth -
                  containerRef.current.clientWidth
              : false
          }
          aria-label='Scroll right'
        >
          <ChevronRight className='h-5 w-5' />
        </button>
      </div>

      <style jsx>{`
        /* Hide scrollbar for Chrome, Safari and Opera */
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
