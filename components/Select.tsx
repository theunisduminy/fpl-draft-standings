import * as React from 'react';

type SelectOption = {
  value: string;
  label: string;
};

type SelectTableProps = {
  options: SelectOption[];
  onSelectChange: (value: string) => void;
  placeholder: string;
};

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SelectTable({
  options,
  onSelectChange,
  placeholder,
}: SelectTableProps) {
  return (
    <Select onValueChange={onSelectChange}>
      <SelectTrigger className='w-[250px]'>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Standings view</SelectLabel>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
