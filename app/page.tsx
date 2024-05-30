'use client';
import { useState } from 'react';
import StandingsTable from '@/components/StandingsTable';
import DraftFixtures from '@/components/DraftFixtures';
import Buttons from '@/components/Buttons';
import { bgGradient } from '@/utils/tailwindVars';

export default function Home() {
  const [activeTable, setActiveTable] = useState('standings');

  return (
    <main className={`md:min-h-[85vh] min-h-[80vh] ${bgGradient} justify-start pt-10 md:pt-20`}>
      <div className='space-x-4 md:space-x-10 pb-10'>
        <Buttons isActive={activeTable === 'standings'} onClick={() => setActiveTable('standings')}>
          Standings
        </Buttons>
        <Buttons isActive={activeTable === 'fixtures'} onClick={() => setActiveTable('fixtures')}>
          Draft Fixtures
        </Buttons>
      </div>
      <div className='mt-4'>
        {activeTable === 'standings' && <StandingsTable />}
        {activeTable === 'fixtures' && <DraftFixtures />}
      </div>
    </main>
  );
}
