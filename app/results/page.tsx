'use client';
import DraftResults from '@/components/TableView/DraftResultsTable';

export default function ResultsView() {
  return (
    <div>
      <h1 className='pb-5 text-4xl font-semibold text-[#310639]'>Results</h1>
      <DraftResults />
    </div>
  );
}
