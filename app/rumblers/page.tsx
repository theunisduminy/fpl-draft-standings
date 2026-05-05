'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Beer, BarChart3 } from 'lucide-react';
import RumblerDataCards from '@/components/RumblerView/RumblerCards';
import RumblerDashboard from '@/components/RumblerView/RumblerDashboard';

export default function Rumblers() {
  return (
    <div className='w-full space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold text-white md:text-3xl'>Rumblers</h1>
        <p className='text-sm text-white/60'>
          Who&apos;s buying the next round?
        </p>
      </div>

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
          <RumblerDataCards />
        </TabsContent>
        <TabsContent value='frequency' className='mt-6'>
          <RumblerDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
