'use client';
import React from 'react';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { tableGradient } from '@/utils/tailwindVars';

export interface TableColumn<T> {
  header: string;
  key: keyof T | ((item: T) => React.ReactNode);
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  cellClassName?: (item: T, index: number) => string;
}

export interface BaseTableProps<T> {
  title: string;
  subtitle?: string;
  data: T[];
  columns: TableColumn<T>[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  className?: string;
  tableClassName?: string;
  rowClassName?: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  children?: React.ReactNode; // For additional content like selectors
}

export function BaseTable<T extends Record<string, any>>({
  title,
  subtitle,
  data,
  columns,
  loading,
  error,
  onRetry,
  emptyMessage,
  className = 'flex w-[350px] flex-col md:w-[600px]',
  tableClassName,
  rowClassName,
  onRowClick,
  children,
}: BaseTableProps<T>) {
  if (loading) return <SkeletonCard />;

  if (error && onRetry) {
    return <ErrorDisplay message={error} onRetry={onRetry} />;
  }

  if (data.length === 0) {
    return (
      <div className={className}>
        <h1 className='pb-2 text-xl font-semibold text-[#310639]'>{title}</h1>
        {subtitle && <p className='pb-5 text-sm'>{subtitle}</p>}
        <p className='pb-5 text-sm'>{emptyMessage || 'No data available.'}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <h1 className='pb-2 text-xl font-semibold text-[#310639]'>{title}</h1>
      {subtitle && <p className='pb-5 text-sm'>{subtitle}</p>}

      {children}

      <div
        className={`mt-6 rounded-lg border-2 border-black p-3 shadow-2xl ${tableGradient} ${tableClassName || ''}`}
      >
        <table className='w-full text-sm font-light text-white'>
          <thead>
            <tr className='border-b-2 border-white'>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`py-2 font-medium ${
                    column.align === 'center'
                      ? 'text-center'
                      : column.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                  } ${column.className || ''}`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={index}
                className={`${onRowClick ? 'cursor-pointer transition-colors hover:bg-white/10' : ''}`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className={`${colIndex < columns.length - 1 ? 'border-r-2 border-white' : ''} py-4 ${
                      column.align === 'center'
                        ? 'text-center'
                        : column.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    } ${column.cellClassName ? column.cellClassName(item, index) : ''}`}
                  >
                    {typeof column.key === 'function'
                      ? column.key(item)
                      : item[column.key as keyof T]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
