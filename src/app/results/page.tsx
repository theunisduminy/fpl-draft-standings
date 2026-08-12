'use client';
import DraftResults from '@/components/TableView/DraftResultsTable';

export default function ResultsView() {
  return (
    <div className='w-full space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold text-white md:text-3xl'>Results</h1>
        <p className='text-sm text-white/60'>Gameweek by gameweek breakdown</p>
      </div>
      <DraftResults />
    </div>
  );
}
