'use client';
import Layout from '@/components/Layout/PageLayout';
import { SelectTable } from '@/components/Select';
import { useState } from 'react';
import RumblerDataCards from '@/components/RumblerView/RumblerCards';
import RumblerDashboard from '@/components/RumblerView/RumblerDashboard';

export default function Rumblers() {
  const [activeTableMatches, setActiveTableMatches] =
    useState<string>('rumblers');

  type SelectOption = {
    value: string;
    label: string;
  };

  // Define options for the select dropdown
  const selectOptions: SelectOption[] = [
    { value: 'rumblers', label: 'Rumbler Victims' },
    { value: 'rumblerFrequency', label: 'Rumbler Frequency' },
  ];

  return (
    <Layout>
      <h1 className='pb-5 text-4xl font-semibold text-[#310639]'>Rumblers</h1>
      <SelectTable
        options={selectOptions}
        onSelectChange={(value) => setActiveTableMatches(value)}
        placeholder='Select an option'
      />

      <hr className='my-6 border border-b border-transparent' />

      <div>{activeTableMatches === 'rumblers' && <RumblerDataCards />}</div>
      <div>
        {activeTableMatches === 'rumblerFrequency' && <RumblerDashboard />}
      </div>
    </Layout>
  );
}
