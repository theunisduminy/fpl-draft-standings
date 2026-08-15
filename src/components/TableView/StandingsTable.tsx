'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { BaseTable } from './base-table';
import { standingsColumns, type StandingsContext } from './table-configs';
import { PlayerDetails } from '@/interfaces/players';

/**
 * The standings board.
 *
 * Presentational: the season and the movement are both read by the page, on
 * the server. This stays a client component only for the row-click
 * navigation.
 */
export default function StandingsTable({
  players,
  movement,
}: { players: PlayerDetails[] } & StandingsContext) {
  const router = useRouter();

  return (
    <BaseTable
      title=''
      data={players}
      columns={standingsColumns({ movement })}
      onRowClick={(player) => router.push(`/players/${player.id}`)}
      emptyMessage='No gameweeks played yet.'
      getRowKey={(player) => player.id}
    />
  );
}
