'use client';
import { useState } from 'react';
import DraftCurrentFixtures from './components/DraftCurrentFixtures';
import ViewButton from '@/components/ViewButtons';
import DraftResults from '@/app/detail/components/DraftResults';

export default function DetailView() {
  const [activeTableMatches, setActiveTableMatches] = useState('fixtures');

  return (
    <main className={`justify-start py-10 md:py-20`}>
      <h1 className='text-[#310639] text-4xl pb-5 font-semibold animate-fade-up text-center'>
        Matches
      </h1>
      <div className='md:grid-cols-3 grid grid-cols-2 gap-4 pb-10'>
        <ViewButton
          isActive={activeTableMatches === 'fixtures'}
          onClick={() => setActiveTableMatches('fixtures')}
        >
          GW Live
        </ViewButton>
        <ViewButton
          isActive={activeTableMatches === 'results'}
          onClick={() => setActiveTableMatches('results')}
        >
          Results
        </ViewButton>
      </div>
      <div className='mt-4'>{activeTableMatches === 'fixtures' && <DraftCurrentFixtures />}</div>
      <div className='mt-4'>{activeTableMatches === 'results' && <DraftResults />}</div>
    </main>
  );
}
