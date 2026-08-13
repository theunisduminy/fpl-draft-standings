'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { BaseTable } from './base-table';
import { standingsTableConfig, tableConfigs } from './table-configs';
import { PlayerDetails } from '@/interfaces/players';

/**
 * Presentational: the season is fetched by the page, on the server.
 * This stays a client component only for the row-click navigation.
 */
export default function StandingsTable({
  players,
}: {
  players: PlayerDetails[];
}) {
  const router = useRouter();
  const config = tableConfigs.standings;

  return (
    <BaseTable
      title=''
      subtitle=''
      data={players}
      columns={standingsTableConfig}
      loading={false}
      error={null}
      onRowClick={(player) => router.push(`/players/${player.id}`)}
      emptyMessage={config.emptyMessage}
      className={config.className}
      tableClassName={config.tableClassName}
      getRowKey={(player) => player.id}
    />
  );
}
