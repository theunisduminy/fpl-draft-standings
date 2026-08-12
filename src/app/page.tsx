'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal } from 'lucide-react';
import FormulaOneTable from '@/components/TableView/StandingsTable';
import PositionPlacedTable from '@/components/TableView/PositionPlacedTable';

export default function Home() {
  return (
    <div className='w-full space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold text-white md:text-3xl'>Standings</h1>
        <p className='text-sm text-white/60'>FPL Draft league rankings</p>
      </div>

      {/* Mobile: Tabs */}
      <div className='md:hidden'>
        <Tabs defaultValue='standings' className='w-full'>
          <TabsList className='grid w-full grid-cols-2 border border-white/10 bg-[#2a0d33]'>
            <TabsTrigger
              value='standings'
              className='gap-2 text-white/70 data-[state=active]:bg-[#3d1a4d] data-[state=active]:text-white'
            >
              <Trophy className='h-4 w-4' />
              Standings
            </TabsTrigger>
            <TabsTrigger
              value='positions'
              className='gap-2 text-white/70 data-[state=active]:bg-[#3d1a4d] data-[state=active]:text-white'
            >
              <Medal className='h-4 w-4' />
              Positions
            </TabsTrigger>
          </TabsList>
          <TabsContent value='standings' className='mt-4'>
            <FormulaOneTable />
          </TabsContent>
          <TabsContent value='positions' className='mt-4'>
            <PositionPlacedTable />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: Stacked */}
      <div className='hidden space-y-8 md:block'>
        <FormulaOneTable />
        <PositionPlacedTable />
      </div>
    </div>
  );
}
