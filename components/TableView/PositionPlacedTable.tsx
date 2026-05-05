'use client';
import React from 'react';
import { useTableData } from '@/hooks/use-table-data';
import { BaseTable } from './base-table';
import { positionPlacedTableConfig, tableConfigs } from './table-configs';
import { PlayerDetails } from '@/interfaces/players';

export default function PositionPlacedTable() {
  const { data, loading, error, refetch } = useTableData<PlayerDetails[]>({
    endpoints: ['standings'],
    transform: (response) => response[0],
  });

  const config = tableConfigs.positionPlaced;

  return (
    <BaseTable
      title=''
      subtitle=''
      data={data || []}
      columns={positionPlacedTableConfig}
      loading={loading}
      error={error}
      onRetry={refetch}
      emptyMessage={config.emptyMessage}
      className={config.className}
      tableClassName={config.tableClassName}
      getRowKey={(player) => player.id}
    />
  );
}
