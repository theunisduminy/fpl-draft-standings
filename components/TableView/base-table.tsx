'use client';
import React from 'react';
import { SkeletonCard } from '@/components/SkeletonTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

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
  children?: React.ReactNode;
  getRowKey?: (item: T, index: number) => string | number;
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
  className = '',
  tableClassName,
  rowClassName,
  onRowClick,
  children,
  getRowKey,
}: BaseTableProps<T>) {
  if (loading) return <SkeletonCard />;

  if (error && onRetry) {
    return <ErrorDisplay message={error} onRetry={onRetry} />;
  }

  if (data.length === 0) {
    return (
      <Card className='w-full border-white/10 bg-[#2a0d33]'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-lg text-white'>{title}</CardTitle>
          {subtitle && (
            <CardDescription className='text-white/60'>
              {subtitle}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <p className='text-sm text-white/50'>
            {emptyMessage || 'No data available.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`w-full space-y-4 ${className}`}>
      <div>
        <h2 className='text-lg font-semibold text-white md:text-xl'>{title}</h2>
        {subtitle && <p className='mt-1 text-sm text-white/60'>{subtitle}</p>}
      </div>

      {children}

      <Card
        className={`overflow-hidden border-white/10 bg-[#2a0d33] ${tableClassName || ''}`}
      >
        <CardContent className='p-0'>
          <ScrollArea className='custom-scrollbar w-full'>
            <Table className='w-full table-fixed'>
              <TableHeader>
                <TableRow className='border-white/10 hover:bg-transparent'>
                  {columns.map((column, index) => (
                    <TableHead
                      key={index}
                      className={`whitespace-nowrap px-3 py-4 text-xs font-semibold uppercase tracking-wider text-white/60 md:px-4 ${
                        column.align === 'center'
                          ? 'text-center'
                          : column.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                      } ${column.className || ''}`}
                      style={column.width ? { width: column.width } : undefined}
                    >
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow
                    key={getRowKey ? getRowKey(item, index) : index}
                    className={`border-white/5 transition-colors ${
                      onRowClick
                        ? 'cursor-pointer hover:bg-white/5'
                        : 'hover:bg-white/5'
                    } ${rowClassName ? rowClassName(item, index) : ''}`}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((column, colIndex) => (
                      <TableCell
                        key={colIndex}
                        className={`px-3 py-4 text-sm text-white/90 md:px-4 md:py-5 ${
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
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation='horizontal' />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
