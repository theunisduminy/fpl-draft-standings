'use client';
import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BaseTable } from './base-table';
import { standingsColumns, tableConfigs } from './table-configs';
import { PlayerDetails } from '@/interfaces/players';
import { rankByPoints } from '@/utils/scoring';

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

  // The league ranks on F1 score, so a manager's points rank is a different
  // number — and the gap between the two is the point of the column.
  const columns = useMemo(
    () => standingsColumns(rankByPoints(players)),
    [players],
  );

  return (
    <BaseTable
      title=''
      subtitle=''
      data={players}
      columns={columns}
      onRowClick={(player) => router.push(`/players/${player.id}`)}
      emptyMessage={config.emptyMessage}
      className={config.className}
      tableClassName={config.tableClassName}
      getRowKey={(player) => player.id}
    />
  );
}
