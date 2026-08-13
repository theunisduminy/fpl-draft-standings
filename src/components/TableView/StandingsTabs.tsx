'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal } from 'lucide-react';
import StandingsTable from './StandingsTable';
import PositionPlacedTable from './PositionPlacedTable';
import { GameweekDataResponse } from '@/interfaces/players';

/**
 * Tabs on mobile, stacked on desktop.
 *
 * Client-side for the tab state. The data arrives as a prop rather than being
 * fetched here, but note the panels below still ship to the browser: their
 * chart leaves are all `'use client'` for recharts, so there is no server
 * subtree to preserve by passing them in as slots.
 */
export function StandingsTabs({ data }: { data: GameweekDataResponse }) {
  return (
    <>
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
            <StandingsTable players={data.players} />
          </TabsContent>
          <TabsContent value='positions' className='mt-4'>
            <PositionPlacedTable data={data} />
          </TabsContent>
        </Tabs>
      </div>

      <div className='hidden space-y-8 md:block'>
        <StandingsTable players={data.players} />
        <PositionPlacedTable data={data} />
      </div>
    </>
  );
}
