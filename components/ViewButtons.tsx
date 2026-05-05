import { ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ViewButtonOption {
  value: string;
  label: ReactNode;
}

interface ViewButtonsProps {
  options: ViewButtonOption[];
  activeValue: string;
  onValueChange: (value: string) => void;
}

export default function ViewButtons({
  options,
  activeValue,
  onValueChange,
}: ViewButtonsProps) {
  return (
    <ToggleGroup
      type='single'
      value={activeValue}
      onValueChange={(value) => {
        if (value) onValueChange(value);
      }}
      className='flex flex-wrap gap-2'
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className='rounded-lg border border-white/20 bg-[#2a0d33] px-4 py-2 text-sm font-medium text-white/70 transition-all hover:border-[#00edfd]/50 hover:bg-[#3d1a4d] hover:text-white data-[state=on]:border-[#00edfd] data-[state=on]:bg-[#00edfd]/20 data-[state=on]:text-[#00edfd]'
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
