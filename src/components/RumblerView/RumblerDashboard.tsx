'use client';

import React from 'react';
import { useTableData } from '@/hooks/use-table-data';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { RumblerFrequencyChart } from './RumblerFrequencyChart';
import { AlertCircle } from 'lucide-react';
import { RumblerGameweekData } from '@/interfaces/players';

export default function RumblerDashboard() {
  const { data, loading, error } = useTableData<RumblerGameweekData[]>({
    endpoints: ['rumbler'],
    transform: (response) => response[0],
  });

  if (loading) return <SkeletonCard />;

  if (error) {
    return (
      <div className='flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400'>
        <AlertCircle className='mr-2 h-4 w-4' />
        <span className='text-sm'>{error}</span>
      </div>
    );
  }

  return <RumblerFrequencyChart data={data || []} />;
}
