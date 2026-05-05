'use client';
import React from 'react';
import { useTableData } from '@/hooks/use-table-data';
import { PositionDistributionChart } from '@/components/PlayerView/PositionDistributionChart';
import { PlayerDetails } from '@/interfaces/players';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';

export default function PositionPlacedTable() {
  const { data, loading, error, refetch } = useTableData<PlayerDetails[]>({
    endpoints: ['standings'],
    transform: (response) => response[0],
  });

  if (loading) return <SkeletonCard />;
  if (error) return <ErrorDisplay message={error} onRetry={refetch} />;
  if (!data || data.length === 0) {
    return (
      <ErrorDisplay
        message='No position data available yet.'
        onRetry={refetch}
      />
    );
  }

  return <PositionDistributionChart players={data} />;
}
