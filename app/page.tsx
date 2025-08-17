'use client';
import FormulaOneTable from '@/components/TableView/StandingsTable';
import PositionPlacedTable from '@/components/TableView/PositionPlacedTable';

export default function Home() {
  return (
    <div>
      <h1 className='pb-5 text-left text-4xl font-semibold text-[#310639]'>
        Standings
      </h1>

      <div className='space-y-8'>
        <FormulaOneTable />
        <PositionPlacedTable />
      </div>
    </div>
  );
}
