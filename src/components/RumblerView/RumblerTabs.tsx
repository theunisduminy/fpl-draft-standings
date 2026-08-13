'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Beer, BarChart3 } from 'lucide-react';
import RumblerDataCards from './RumblerCards';
import RumblerDashboard from './RumblerDashboard';
import { RumblerGameweekData } from '@/interfaces/players';

/** Client-side purely for the tab state; the data arrives from the server. */
export function RumblerTabs({ data }: { data: RumblerGameweekData[] }) {
  return (
    <Tabs defaultValue='rumblers' className='w-full'>
      <TabsList className='grid w-full grid-cols-2 border border-white/10 bg-[#2a0d33] md:w-[400px]'>
        <TabsTrigger
          value='rumblers'
          className='gap-2 text-white/70 data-[state=active]:bg-[#3d1a4d] data-[state=active]:text-white'
        >
          <Beer className='h-4 w-4' />
          Victims
        </TabsTrigger>
        <TabsTrigger
          value='frequency'
          className='gap-2 text-white/70 data-[state=active]:bg-[#3d1a4d] data-[state=active]:text-white'
        >
          <BarChart3 className='h-4 w-4' />
          Frequency
        </TabsTrigger>
      </TabsList>
      <TabsContent value='rumblers' className='mt-6'>
        <RumblerDataCards gameweekData={data} />
      </TabsContent>
      <TabsContent value='frequency' className='mt-6'>
        <RumblerDashboard data={data} />
      </TabsContent>
    </Tabs>
  );
}
