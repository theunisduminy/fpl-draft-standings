'use client';
import { useState } from 'react';
import SeasonPointsTable from '@/components/SeasonPointsTable';
import FormulaOneTable from '@/components/StandingsTable';
import PositionPlacedTable from '@/components/PositionPlacedTable';
import Layout from '@/components/Layout/PageLayout';
import { SelectTable } from '@/components/Select';

export default function Home() {
  const [activeTable, setActiveTable] = useState<string>('standings');

  type SelectOption = {
    value: string;
    label: string;
  };

  // Define options for the select dropdown
  const selectOptions: SelectOption[] = [
    { value: 'standings', label: 'Standings' },
    { value: 'points', label: 'Season Points' },
    { value: 'position-placed', label: 'Position Placed' },
  ];

  return (
    <Layout>
      <h1 className='pb-5 text-left text-4xl font-semibold text-[#310639]'>
        Standings
      </h1>
      <SelectTable
        options={selectOptions}
        onSelectChange={(value) => setActiveTable(value)}
        placeholder='Select an option'
      />

      <hr className='mt-6 border border-b border-gray-600' />

      <div className='mt-4'>
        {activeTable === 'standings' && <FormulaOneTable />}
      </div>
      <div className='mt-4'>
        {activeTable === 'points' && <SeasonPointsTable />}
      </div>
      <div className='mt-4'>
        {activeTable === 'position-placed' && <PositionPlacedTable />}
      </div>
    </Layout>
  );
}
