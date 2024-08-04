'use client';
import { useState } from 'react';
import SeasonPointsTable from '@/components/SeasonPointsTable';
import FormulaOneTable from '@/components/FormulaOneTable';
import ViewButton from '@/components/ViewButtons';
import { bgGradient } from '@/utils/tailwindVars';

export default function Home() {
  const [activeTable, setActiveTable] = useState('standings');

  return (
    <main className={`${bgGradient} justify-start pt-10 pb-20 md:py-20 md:pb-0`}>
      <h1 className='text-[#310639] text-4xl pb-5 font-semibold animate-fade-up text-center'>
        Standings
      </h1>
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
      </div>
      <div className='mt-4'>
        {activeTable === 'standings' && <FormulaOneTable />}
        {activeTable === 'points' && <SeasonPointsTable />}
      </div>
    </main>
  );
}
