'use client';

import React from 'react';
import { useTableData } from '@/hooks/use-table-data';
import { SkeletonCard } from '@/components/SkeletonTable';
import { RumblerFrequencyChart } from './RumblerFrequencyChart';
import { AlertCircle } from 'lucide-react';
import { RumblerGameweekData } from '@/interfaces/players';

export default function RumblerDashboard() {
  const { data, loading, error } = useTableData<RumblerGameweekData[]>({
    endpoints: ['rumbler'],
    transform: (response) => response[0], // Extract first element from response array
  });

  if (loading) return <SkeletonCard />;

  if (error) {
    return (
      <div className='flex items-center justify-center p-4 text-red-500'>
        <AlertCircle className='mr-2' />
        <span>{error}</span>
      </div>
    );
  }

  return <RumblerFrequencyChart data={data || []} />;
}
