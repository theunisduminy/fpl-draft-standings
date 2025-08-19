'use client';
import React from 'react';
import { useTableData } from '@/hooks/use-table-data';
import { positionPlacedTableConfig, tableConfigs } from './table-configs';
import { PlayerDetails } from '@/interfaces/players';

export default function PositionPlacedTable() {
  const { data, loading, error } = useTableData<PlayerDetails[]>({
    endpoints: ['standings'],
    transform: (response) => response[0], // Extract first element from response array
  });

  const config = tableConfigs.positionPlaced;

  return (
    <div className={config.className}>
      <h1 className='pb-5 text-xl font-semibold text-[#310639]'>
        {config.title} <br />
        <span className='text-sm md:hidden'>(scroll right)</span>
      </h1>
      <p className='pb-5 text-sm'>{config.subtitle}</p>

      <div
        className={`mb-8 rounded-lg border-2 border-black bg-gradient-to-br from-ruddyBlue/90 to-sky-800 p-5 shadow-2xl`}
      >
        <div className='w-[290px] overflow-x-auto md:w-full'>
          <table className='min-w-[600px] table-fixed text-white'>
            <thead>
              <tr>
                {positionPlacedTableConfig.map((column, index) => (
                  <th
                    key={index}
                    className={`py-2 font-medium ${
                      column.align === 'center'
                        ? 'text-center'
                        : column.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    } ${column.className || ''}`}
                    style={
                      column.width ? { width: column.width } : { width: 'auto' }
                    }
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={positionPlacedTableConfig.length}
                    className='py-4 text-center'
                  >
                    Loading...
                  </td>
                </tr>
              ) : (
                (data || []).map((player: PlayerDetails, index) => (
                  <tr key={player.id}>
                    {positionPlacedTableConfig.map((column, colIndex) => (
                      <td
                        key={colIndex}
                        className={`py-4 ${
                          column.align === 'center'
                            ? 'text-center'
                            : column.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                        } ${column.cellClassName ? column.cellClassName(player, index) : ''}`}
                      >
                        {typeof column.key === 'function'
                          ? column.key(player)
                          : String(player[column.key as keyof PlayerDetails])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
