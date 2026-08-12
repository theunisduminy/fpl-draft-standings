import * as React from 'react';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SelectOption = {
  value: string;
  label: string;
};

type SelectTableProps = {
  options: SelectOption[];
  onSelectChange: (value: string) => void;
  placeholder: string;
};

export function SelectTable({
  options,
  onSelectChange,
  placeholder,
}: SelectTableProps) {
  return (
    <Select onValueChange={onSelectChange}>
      <SelectTrigger className='w-full border-white/20 bg-[#2a0d33] text-white md:w-[250px]'>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className='border-white/20 bg-[#1a0520]'>
        <SelectGroup>
          <SelectLabel className='text-white/50'>Standings view</SelectLabel>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className='text-white focus:bg-white/10 focus:text-white'
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
