'use client';
import React from 'react';
import { useTableData } from '@/hooks/use-table-data';
import { BaseTable } from './base-table';
import { standingsTableConfig, tableConfigs } from './table-configs';
import { PlayerDetails } from '@/interfaces/players';

export default function StandingsTable() {
  const { data, loading, error, refetch } = useTableData<PlayerDetails[]>({
    endpoints: ['standings'],
    transform: (response) => response[0], // Extract first element from response array
  });

  const config = tableConfigs.standings;

  const handleRowClick = (player: PlayerDetails) => {
    // Navigate to player detail page
    window.location.href = `/players/${player.id}`;
  };

  return (
    <BaseTable
      title={config.title}
      subtitle={config.subtitle}
      data={data || []}
      columns={standingsTableConfig}
      loading={loading}
      error={error}
      onRetry={refetch}
      onRowClick={handleRowClick}
      emptyMessage={config.emptyMessage}
      className={config.className}
      tableClassName={config.tableClassName}
    />
  );
}
