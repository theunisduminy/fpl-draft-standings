'use client';
import { useState } from 'react';
import SeasonPointsTable from '@/components/SeasonPointsTable';
import FormulaOneTable from '@/components/StandingsTable';
import PositionPlacedTable from '@/components/PositionPlacedTable';
import ViewButton from '@/components/ViewButtons';
import Layout from '@/components/Layout/PageLayout';

export default function Home() {
  const [activeTable, setActiveTable] = useState('standings');

  return (
    <Layout>
      <h1 className='text-[#310639] text-4xl pb-5 font-semibold text-center'>Standings</h1>
      <div className='grid grid-cols-2 gap-4 pb-10'>
        <ViewButton
          isActive={activeTable === 'standings'}
          onClick={() => setActiveTable('standings')}
        >
          Standings
        </ViewButton>
        <ViewButton isActive={activeTable === 'points'} onClick={() => setActiveTable('points')}>
          Season Points
        </ViewButton>
        <ViewButton
          isActive={activeTable === 'position-placed'}
          onClick={() => setActiveTable('position-placed')}
        >
          Position Placed
        </ViewButton>
      </div>
      <div className='mt-4'>
        {activeTable === 'standings' && <FormulaOneTable />}
        {activeTable === 'points' && <SeasonPointsTable />}
        {activeTable === 'position-placed' && <PositionPlacedTable />}
      </div>
    </Layout>
  );
}
