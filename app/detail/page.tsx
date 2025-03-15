'use client';
import { useState } from 'react';
import DraftResults from '@/components/TableView/DraftResultsTable';
import DraftFixtures from '@/components/TableView/DraftFixturesTable';
import { SelectTable } from '@/components/Select';

// Define the type for select options
type SelectOption = {
  value: string;
  label: string;
};

export default function DetailView() {
  const [activeTableMatches, setActiveTableMatches] =
    useState<string>('fixtures');

  // Define options for the select dropdown
  const selectOptions: SelectOption[] = [
    { value: 'fixtures', label: 'H2H Fixtures' },
    { value: 'results', label: 'H2H Results' },
  ];

  return (
    <div>
      <h1 className='pb-5 text-4xl font-semibold text-[#310639]'>Matches</h1>
      <SelectTable
        options={selectOptions}
        onSelectChange={(value) => setActiveTableMatches(value)}
        placeholder='Select an option'
      />

      <hr className='my-6 border border-b border-transparent' />

      <div>{activeTableMatches === 'results' && <DraftResults />}</div>
      <div>{activeTableMatches === 'fixtures' && <DraftFixtures />}</div>
    </div>
  );
}
