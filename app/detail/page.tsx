'use client';
import { useState } from 'react';
import DraftCurrentFixtures from './components/DraftCurrentFixtures';
import DraftResults from '@/app/detail/components/DraftResults';
import DraftFixtures from '@/app/detail/components/DraftFixtures';
import Layout from '@/components/Layout/PageLayout';
import { SelectTable } from '@/components/Select';

// Define the type for select options
type SelectOption = {
  value: string;
  label: string;
};

export default function DetailView() {
  const [activeTableMatches, setActiveTableMatches] =
    useState<string>('currentFixtures');

  // Define options for the select dropdown
  const selectOptions: SelectOption[] = [
    { value: 'currentFixtures', label: 'GW Live' },
    { value: 'results', label: 'H2H Results' },
    { value: 'fixtures', label: 'H2H Fixtures' },
  ];

  return (
    <Layout>
      <h1 className='pb-5 text-4xl font-semibold text-[#310639]'>Matches</h1>
      <SelectTable
        options={selectOptions}
        onSelectChange={(value) => setActiveTableMatches(value)}
        placeholder='Select an option'
      />

      <hr className='mt-6 border border-b border-gray-600' />

      <div className='mt-4'>
        {activeTableMatches === 'currentFixtures' && <DraftCurrentFixtures />}
      </div>
      <div className='mt-4'>
        {activeTableMatches === 'results' && <DraftResults />}
      </div>
      <div className='mt-4'>
        {activeTableMatches === 'fixtures' && <DraftFixtures />}
      </div>
    </Layout>
  );
}
