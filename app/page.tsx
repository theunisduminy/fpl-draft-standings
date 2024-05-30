'use client';
import { useState } from 'react';
import LeagueStandingsTable from '@/components/LeagueStandingsTable';
import DraftFixtures from '@/components/DraftFixtures';
import ViewButton from '@/components/ViewButtons';
import { bgGradient } from '@/utils/tailwindVars';

export default function Home() {
  const [activeTable, setActiveTable] = useState('standings');

  return (
    <main className={`md:min-h-[85vh] min-h-[80vh] ${bgGradient} justify-start pt-10 md:pt-20`}>
      <div className='space-x-4 md:space-x-10 pb-10'>
        <ViewButton
          isActive={activeTable === 'standings'}
          onClick={() => setActiveTable('standings')}
        >
          Standings
        </ViewButton>
        <ViewButton
          isActive={activeTable === 'fixtures'}
          onClick={() => setActiveTable('fixtures')}
        >
          Draft Fixtures
        </ViewButton>
      </div>
      <div className='mt-4'>
        {activeTable === 'standings' && <LeagueStandingsTable />}
        {activeTable === 'fixtures' && <DraftFixtures />}
      </div>
    </main>
  );
}
