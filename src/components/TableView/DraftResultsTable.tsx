'use client';
import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { BaseTable } from './base-table';
import {
  draftResultsColumns,
  tableConfigs,
  GameweekResult,
} from './table-configs';
import { GameweekDataResponse } from '@/interfaces/players';
import { GameweekSelector } from '@/components/GameweekSelector';
import { useViewTeam, ViewTeamDrawer } from './ViewTeamDrawer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, BarChart3, Minus } from 'lucide-react';

export default function DraftResultsTable({
  data,
}: {
  data: GameweekDataResponse;
}) {
  // `null` means "the reader hasn't chosen yet", so we fall back to `?gw=` and
  // then to the most recent gameweek. Deriving the default beats storing it:
  // setting state from inside useMemo triggers a cascading render, which React
  // 19 flags.
  const [selectedGameweek, setSelectedGameweek] = useState<number | null>(null);

  const gameweeks = data.completedGameweeks;
  const requestedGameweek = Number(useSearchParams().get('gw'));

  // `completedGameweeks` arrives newest-first.
  const activeGameweek =
    selectedGameweek ??
    (gameweeks.includes(requestedGameweek)
      ? requestedGameweek
      : gameweeks[0]) ??
    0;

  /**
   * Select a gameweek and mirror it into the URL.
   *
   * `history.replaceState`, deliberately, **not** `router.replace`: the table
   * already holds every gameweek, so a navigation would re-render the route on
   * the server — a couple of seconds of force-dynamic work — to arrive at
   * markup the client could produce instantly. This way `/results?gw=5` is
   * shareable and the pills stay free.
   */
  function selectGameweek(gameweek: number) {
    setSelectedGameweek(gameweek);
    window.history.replaceState(null, '', `?gw=${gameweek}`);
  }

  const formattedResults: GameweekResult[] = useMemo(() => {
    if (!activeGameweek) return [];

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

  // One drawer for the whole table; the rows only name a target.
  const viewTeam = useViewTeam(activeGameweek);

  const columns = draftResultsColumns((result: GameweekResult) =>
    viewTeam.open({
      leagueEntry: result.league_entry,
      playerName: result.player_name,
    }),
  );

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

  if (gameweeks.length === 0) {
    return (
      <BaseTable
        title=''
        subtitle=''
        data={formattedResults}
        columns={columns}
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
        onSelectGameweek={selectGameweek}
      />

      <BaseTable
        title=''
        subtitle=''
        data={formattedResults}
        columns={columns}
        getRowKey={(result) => result.league_entry}
      />

      <ViewTeamDrawer view={viewTeam} />

      {summaryStats && (
        <Card className='border-white/10 bg-[#2a0d33]'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base text-white md:text-lg'>
              Gameweek {activeGameweek} Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
              <StatCard
                icon={<TrendingUp className='h-4 w-4 text-yellow-400' />}
                label='Highest'
                value={`${summaryStats.highestScore} pts`}
                names={summaryStats.highestScorers.map((p) => p.player_name)}
              />
              <StatCard
                icon={<TrendingDown className='h-4 w-4 text-red-400' />}
                label='Lowest'
                value={`${summaryStats.lowestScore} pts`}
                names={summaryStats.lowestScorers.map((p) => p.player_name)}
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
  names,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Whoever the stat belongs to. A tie is more than one badge. */
  names?: string[];
}) {
  // Exactly two rows, whether or not there is a name to show: label above,
  // value and name on one baseline below. The name sits to the right so the
  // cards without one (average, difference) end at the same height.
  return (
    <div className='rounded-lg bg-[#1a0520] p-3'>
      <div className='mb-1 flex items-center gap-2'>
        {icon}
        <span className='text-xs text-white/50'>{label}</span>
      </div>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-sm font-bold text-white md:text-base'>{value}</p>
        <div className='flex min-w-0 flex-wrap justify-end gap-1'>
          {names?.map((name) => (
            <Badge
              key={name}
              className='max-w-full border-white/10 bg-white/5 text-white/80'
            >
              <span className='truncate'>{name}</span>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
