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
import { tableGradient } from '@/utils/tailwindVars';

export default function DraftResultsTable() {
  const [selectedGameweek, setSelectedGameweek] = useState<number>(0);

  const { data, loading, error, refetch } = useTableData<GameweekDataResponse>({
    endpoints: ['gameweek-data'],
    transform: (response) => response[0], // Extract first element from response array
  });

  // Extract completed gameweeks and set default selection
  const gameweeks = useMemo(() => {
    if (!data?.completedGameweeks) return [];

    // Set default selected gameweek to the most recent one
    if (data.completedGameweeks.length > 0 && selectedGameweek === 0) {
      setSelectedGameweek(data.completedGameweeks[0]);
    }

    return data.completedGameweeks;
  }, [data?.completedGameweeks, selectedGameweek]);

  // Process data for selected gameweek with position movement
  const formattedResults: GameweekResult[] = useMemo(() => {
    if (!data || !selectedGameweek) return [];

    const gameweekResults = data.gameweekPerformances
      .filter((gw) => gw.event === selectedGameweek && gw.finished)
      .sort((a, b) => a.rank - b.rank);

    return gameweekResults.map((gw) => {
      const player = data.players.find((p) => p.id === gw.league_entry);

      // Calculate position movement by comparing to previous gameweek
      let positionMovement: number | undefined = undefined;

      if (selectedGameweek > 1) {
        const previousGameweek = selectedGameweek - 1;
        const previousRank = data.gameweekPerformances.find(
          (prevGw) =>
            prevGw.event === previousGameweek &&
            prevGw.league_entry === gw.league_entry &&
            prevGw.finished,
        )?.rank;

        if (previousRank !== undefined) {
          // Position movement: previous rank - current rank (positive = moved up)
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
  }, [data, selectedGameweek]);

  const config = tableConfigs.draftResults;

  if (loading || error || gameweeks.length === 0) {
    return (
      <BaseTable
        title={config.title}
        subtitle={config.subtitle}
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
    <div className='flex w-[350px] flex-col md:w-[600px]'>
      <h1 className='pb-2 text-xl font-semibold text-[#310639]'>
        {config.title}
      </h1>
      <p className='pb-5 text-sm'>{config.subtitle}</p>

      <GameweekSelector
        gameweeks={gameweeks}
        selectedGameweek={selectedGameweek}
        onSelectGameweek={setSelectedGameweek}
        label='Select Gameweek'
      />

      <div className='mt-6 space-y-6'>
        {/* Results Table */}
        <div
          className={`rounded-lg border-2 border-black ${tableGradient} p-5 shadow-2xl`}
        >
          <h2 className='pb-3 text-xl font-medium text-white'>
            Gameweek {selectedGameweek} Rankings
          </h2>
          <table className='w-full text-sm font-light text-white'>
            <thead>
              <tr className='border-b-2 border-white'>
                {draftResultsTableConfig.map((column, index) => (
                  <th
                    key={index}
                    className={`py-2 font-medium ${
                      column.align === 'center'
                        ? 'text-center'
                        : column.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    } ${column.className || ''}`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formattedResults.map((result, index) => (
                <tr key={result.league_entry}>
                  {draftResultsTableConfig.map((column, colIndex) => (
                    <td
                      key={colIndex}
                      className={`py-4 ${colIndex < draftResultsTableConfig.length - 1 ? 'border-r-2 border-white' : ''} ${
                        column.align === 'center'
                          ? 'text-center'
                          : column.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                      } ${column.cellClassName ? column.cellClassName(result, index) : ''}`}
                    >
                      {typeof column.key === 'function'
                        ? column.key(result)
                        : result[column.key as keyof GameweekResult]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        {formattedResults.length > 0 &&
          (() => {
            // Find all players with the highest score
            const highestScore = formattedResults[0]?.points;
            const highestScorers = formattedResults.filter(
              (r) => r.points === highestScore,
            );

            // Find all players with the lowest score
            const lowestScore =
              formattedResults[formattedResults.length - 1]?.points;
            const lowestScorers = formattedResults.filter(
              (r) => r.points === lowestScore,
            );

            return (
              <div
                className={`rounded-lg border-2 border-black ${tableGradient} p-6 shadow-2xl`}
              >
                <h3 className='pb-3 text-lg font-medium text-white'>
                  Gameweek {selectedGameweek} Summary
                </h3>
                <div className='grid grid-cols-2 gap-4 text-white'>
                  <div>
                    <p className='text-sm text-gray-300'>Highest Score</p>
                    <p className='text-lg font-bold text-yellow-300'>
                      {highestScore} pts (
                      {highestScorers.map((p) => p.player_name).join(', ')})
                    </p>
                  </div>
                  <div>
                    <p className='text-sm text-gray-300'>Lowest Score</p>
                    <p className='text-lg font-bold text-red-300'>
                      {lowestScore} pts (
                      {lowestScorers.map((p) => p.player_name).join(', ')})
                    </p>
                  </div>
                  <div>
                    <p className='text-sm text-gray-300'>Average Score</p>
                    <p className='text-lg font-bold'>
                      {(
                        formattedResults.reduce((sum, r) => sum + r.points, 0) /
                        formattedResults.length
                      ).toFixed(1)}{' '}
                      pts
                    </p>
                  </div>
                  <div>
                    <p className='text-sm text-gray-300'>Point Difference</p>
                    <p className='text-lg font-bold'>
                      {highestScore - lowestScore} pts
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
