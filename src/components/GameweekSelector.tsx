'use client';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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
  return (
    <div className='w-full space-y-2'>
      <Label className='text-sm font-medium text-white/80'>{label}</Label>
      <ScrollArea className='w-full whitespace-nowrap rounded-lg'>
        <ToggleGroup
          type='single'
          value={String(selectedGameweek)}
          onValueChange={(value) => {
            if (value) onSelectGameweek(Number(value));
          }}
          className='flex w-full justify-start gap-1.5 pb-2'
        >
          {gameweeks.map((gameweek) => (
            <ToggleGroupItem
              key={gameweek}
              value={String(gameweek)}
              className='min-w-[70px] rounded-lg border border-white/20 bg-[#2a0d33] px-3 py-2 text-xs font-semibold text-white transition-all hover:border-[#00edfd]/50 hover:bg-[#3d1a4d] hover:text-[#00edfd] data-[state=on]:border-[#00edfd] data-[state=on]:bg-[#00edfd]/20 data-[state=on]:text-[#00edfd] md:text-sm'
            >
              GW {gameweek}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ScrollBar orientation='horizontal' className='h-1.5' />
      </ScrollArea>
    </div>
  );
}
