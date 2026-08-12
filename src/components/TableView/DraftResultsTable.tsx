'use client';
import React, { useState, useMemo } from 'react';
import { useTableData } from '@/hooks/use-table-data';
import { BaseTable } from './base-table';
import {
  draftResultsTableConfig,
  tableConfigs,
  GameweekResult,
} from './table-configs';
import { GameweekDataResponse } from '@/interfaces/players';
import { GameweekSelector } from '@/components/GameweekSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, BarChart3, Minus } from 'lucide-react';

export default function DraftResultsTable() {
  // `null` means "the reader hasn't chosen yet", so we fall back to the most
  // recent gameweek. Deriving the default beats storing it: setting state from
  // inside useMemo triggers a cascading render, which React 19 flags.
  const [selectedGameweek, setSelectedGameweek] = useState<number | null>(null);

  const { data, loading, error, refetch } = useTableData<GameweekDataResponse>({
    endpoints: ['gameweek-data'],
    transform: (response) => response[0],
  });

  const gameweeks = useMemo(
    () => data?.completedGameweeks ?? [],
    [data?.completedGameweeks],
  );

  // `completedGameweeks` arrives newest-first.
  const activeGameweek = selectedGameweek ?? gameweeks[0] ?? 0;

  const formattedResults: GameweekResult[] = useMemo(() => {
    if (!data || !activeGameweek) return [];

    const gameweekResults = data.gameweekPerformances
      .filter((gw) => gw.event === activeGameweek && gw.finished)
      .sort((a, b) => a.rank - b.rank);

    return gameweekResults.map((gw) => {
      const player = data.players.find((p) => p.id === gw.league_entry);
      let positionMovement: number | undefined = undefined;

      if (activeGameweek > 1) {
        const previousGameweek = activeGameweek - 1;
        const previousRank = data.gameweekPerformances.find(
          (prevGw) =>
            prevGw.event === previousGameweek &&
            prevGw.league_entry === gw.league_entry &&
            prevGw.finished,
        )?.rank;

        if (previousRank !== undefined) {
          positionMovement = previousRank - gw.rank;
        }
      }

      return {
        rank: gw.rank,
        player_name: player ? player.player_name : 'Unknown',
        team_name: player ? player.team_name : 'Unknown',
        points: gw.event_total,
        league_entry: gw.league_entry,
        position_movement: positionMovement,
      };
    });
  }, [data, activeGameweek]);

  const config = tableConfigs.draftResults;

  const summaryStats = useMemo(() => {
    if (formattedResults.length === 0) return null;
    const highestScore = formattedResults[0]?.points;
    const highestScorers = formattedResults.filter(
      (r) => r.points === highestScore,
    );
    const lowestScore = formattedResults[formattedResults.length - 1]?.points;
    const lowestScorers = formattedResults.filter(
      (r) => r.points === lowestScore,
    );
    const average =
      formattedResults.reduce((sum, r) => sum + r.points, 0) /
      formattedResults.length;

    return {
      highestScore,
      highestScorers,
      lowestScore,
      lowestScorers,
      average,
      diff: highestScore - lowestScore,
    };
  }, [formattedResults]);

  if (loading || error || gameweeks.length === 0) {
    return (
      <BaseTable
        title=''
        subtitle=''
        data={formattedResults}
        columns={draftResultsTableConfig}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage={config.emptyMessage}
        getRowKey={(result) => result.league_entry}
      />
    );
  }

  return (
    <div className='w-full space-y-6'>
      <GameweekSelector
        gameweeks={gameweeks}
        selectedGameweek={activeGameweek}
        onSelectGameweek={setSelectedGameweek}
        label='Select Gameweek'
      />

      <BaseTable
        title=''
        subtitle=''
        data={formattedResults}
        columns={draftResultsTableConfig}
        loading={false}
        error={null}
        getRowKey={(result) => result.league_entry}
      />

      {summaryStats && (
        <Card className='border-white/10 bg-[#2a0d33]'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base text-white md:text-lg'>
              Gameweek {activeGameweek} Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
              <StatCard
                icon={<TrendingUp className='h-4 w-4 text-yellow-400' />}
                label='Highest'
                value={`${summaryStats.highestScore} pts`}
                detail={summaryStats.highestScorers
                  .map((p) => p.player_name)
                  .join(', ')}
              />
              <StatCard
                icon={<TrendingDown className='h-4 w-4 text-red-400' />}
                label='Lowest'
                value={`${summaryStats.lowestScore} pts`}
                detail={summaryStats.lowestScorers
                  .map((p) => p.player_name)
                  .join(', ')}
              />
              <StatCard
                icon={<BarChart3 className='h-4 w-4 text-[#00edfd]' />}
                label='Average'
                value={`${summaryStats.average.toFixed(1)} pts`}
              />
              <StatCard
                icon={<Minus className='h-4 w-4 text-[#75fa95]' />}
                label='Difference'
                value={`${summaryStats.diff} pts`}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className='rounded-lg bg-[#1a0520] p-3'>
      <div className='mb-1 flex items-center gap-2'>
        {icon}
        <span className='text-xs text-white/50'>{label}</span>
      </div>
      <p className='text-sm font-bold text-white md:text-base'>{value}</p>
      {detail && (
        <p className='mt-1 truncate text-[10px] text-white/40'>{detail}</p>
      )}
    </div>
  );
}
