'use client';
import { useState } from 'react';
import SeasonPointsTable from '@/components/TableView/SeasonPointsTable';
import FormulaOneTable from '@/components/TableView/StandingsTable';
import PositionPlacedTable from '@/components/TableView/PositionPlacedTable';
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
    { value: 'standings', label: 'Draft Standings' },
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

      <hr className='my-6 border border-b border-transparent' />

      <div>{activeTable === 'standings' && <FormulaOneTable />}</div>
      <div>{activeTable === 'points' && <SeasonPointsTable />}</div>
      <div>{activeTable === 'position-placed' && <PositionPlacedTable />}</div>
    </Layout>
  );
}
