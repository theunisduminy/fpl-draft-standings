'use client';
import { useState } from 'react';
import LeagueStandingsTable from '@/components/LeagueStandingsTable';
import LeagueDetailTable from '@/components/LeagueDetailTable';
import FormulaOneTable from '@/components/FormulaOneTable';
import ViewButton from '@/components/ViewButtons';
import { bgGradient } from '@/utils/tailwindVars';

export default function Home() {
  const [activeTable, setActiveTable] = useState('standings');

  return (
    <main className={`${bgGradient} justify-start py-10 md:py-20`}>
      <h1 className='text-[#310639] text-4xl pb-5 font-semibold animate-fade-up text-center'>
        Standings
      </h1>
      <div className='md:grid-cols-3 grid grid-cols-2 gap-4 pb-10'>
        <ViewButton
          isActive={activeTable === 'standings'}
          onClick={() => setActiveTable('standings')}
        >
          Standings
        </ViewButton>
        <ViewButton isActive={activeTable === 'points'} onClick={() => setActiveTable('points')}>
          Points
        </ViewButton>
        <ViewButton
          isActive={activeTable === 'formula-one'}
          onClick={() => setActiveTable('formula-one')}
        >
          Formula one
        </ViewButton>
      </div>
      <div className='mt-4'>
        {activeTable === 'standings' && <LeagueStandingsTable />}
        {activeTable === 'points' && <LeagueDetailTable />}
        {activeTable === 'formula-one' && <FormulaOneTable />}
      </div>
    </main>
  );
}
