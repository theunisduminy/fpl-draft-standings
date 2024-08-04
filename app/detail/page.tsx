'use client';
import { useState } from 'react';
import DraftCurrentFixtures from './components/DraftCurrentFixtures';
import ViewButton from '@/components/ViewButtons';
import DraftResults from '@/app/detail/components/DraftResults';
import DraftFixtures from '@/app/detail/components/DraftFixtures';

export default function DetailView() {
  const [activeTableMatches, setActiveTableMatches] = useState('currentFixtures');

  return (
    <main className={`justify-start py-10 md:py-20`}>
      <h1 className='text-[#310639] text-4xl pb-5 font-semibold animate-fade-up text-center'>
        Matches
      </h1>
      <div className='grid grid-cols-2 gap-4 pb-10'>
        <ViewButton
          isActive={activeTableMatches === 'currentFixtures'}
          onClick={() => setActiveTableMatches('currentFixtures')}
        >
          GW Live
        </ViewButton>
        <ViewButton
          isActive={activeTableMatches === 'results'}
          onClick={() => setActiveTableMatches('results')}
        >
          Results
        </ViewButton>
        <ViewButton
          isActive={activeTableMatches === 'fixtures'}
          onClick={() => setActiveTableMatches('fixtures')}
        >
          Fixtures
        </ViewButton>
      </div>
      <div className='mt-4'>
        {activeTableMatches === 'currentFixtures' && <DraftCurrentFixtures />}
      </div>
      <div className='mt-4'>{activeTableMatches === 'results' && <DraftResults />}</div>
      <div className='mt-4'>{activeTableMatches === 'fixtures' && <DraftFixtures />}</div>
    </main>
  );
}
