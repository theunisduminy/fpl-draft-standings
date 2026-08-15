'use client';
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
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
  /**
   * Column width as Tailwind classes, breakpoints included:
   * `'w-[45%] md:w-[34%]'`.
   *
   * Classes rather than an inline `style`, because a column that changes width
   * at a breakpoint cannot be expressed inline — and two mechanisms on one
   * table cannot be mixed safely, since an inline width beats any class.
   */
  width?: string;
  /**
   * Hide this column below a breakpoint, header and cells together.
   *
   * One flag rather than `hidden md:table-cell` written into both `width` and
   * `cellClassName`: the two halves have to agree, and a per-row function that
   * ignores its row is not really a per-row class.
   */
  hideBelow?: 'sm' | 'md' | 'lg';
  className?: string;
  cellClassName?: (item: T, index: number) => string;
}

/** Header and cell padding, exported so `TableSkeleton` cannot drift from it. */
export const TABLE_HEAD_CLASS =
  'px-3 py-3 text-xs font-semibold tracking-wider whitespace-nowrap text-white/60 uppercase md:px-4';
export const TABLE_CELL_CLASS =
  'px-3 py-3 text-sm text-white/90 md:px-4 md:py-3.5';

/**
 * The shape of a body row: how tall it is, and the fact that it draws no line.
 *
 * **Height.** The results table set it first, because its rows are the tallest
 * thing we ask a row to hold: a medium rank badge beside a two-line player
 * cell. Left to content, a table whose cells happen to be one line short would
 * draw itself tighter, and two tables on the same page would have different
 * rhythms — which is exactly what the standings and results tables used to do.
 * So it is a floor, not a fixed height: `height` on a `<tr>` is a minimum, and
 * a row that genuinely needs more still grows.
 *
 * **No divider.** `border-0` undoes the `border-b` the shadcn `TableRow`
 * primitive carries, and it is not a stylistic preference — a full-bleed rule
 * and a rounded hover fill are two contradictory claims about where a row
 * ends, and the eye reads the disagreement as the lines being too loud. Rows
 * are separated by height and by the hover highlight instead; the only rule
 * left in the table is the one under the header, which separates two genuinely
 * different kinds of thing. Bring the dividers back and the hover has to lose
 * its corners in the same change.
 *
 * `TableSkeleton` imports this rather than restating it, so the loading shape
 * cannot drift from the real one.
 */
export const TABLE_ROW_CLASS = 'h-14 border-0 md:h-15';

/**
 * The hover highlight, rounded at its ends.
 *
 * It has to be painted on the **cells**, not on the `<tr>`: a table row
 * ignores `border-radius` in every browser, so a background set there is a
 * hard-edged block whatever radius you ask for. Rounding the first and last
 * cell of the row gives the highlight two rounded ends and leaves the middle
 * flush, which is the shape you actually want.
 *
 * `rounded-sm` is the smallest step in the theme scale (`--radius` minus 4px),
 * deliberately: the row is a strip of a card that is already rounded, and
 * anything larger starts to read as a pill floating inside the table.
 */
export const TABLE_ROW_HOVER_CLASS = [
  // The primitive paints its own `hover:bg-muted/50` on the `<tr>`, and that
  // one *is* a hard-edged block — it would sit in the four corners the cells
  // round away. Off, so the cell fill below is the only hover paint.
  'hover:bg-transparent',
  'hover:[&>td]:bg-white/5',
  '[&>td]:transition-colors',
  '[&>td:first-child]:rounded-l-sm',
  '[&>td:last-child]:rounded-r-sm',
].join(' ');

/**
 * `hidden` plus the matching `table-cell` at the breakpoint, or nothing.
 *
 * **Written out as literals, because Tailwind reads the source.** This was a
 * template — `` `hidden ${hideBelow}:table-cell` `` — and a class assembled at
 * runtime is a class Tailwind has never seen, so it generates no rule for it.
 * The compiled stylesheet contained `.md\:table-cell` and nothing else, and
 * only by accident: `table-skeleton.tsx` happens to spell that one out. Every
 * column marked `sm` or `lg` therefore kept the `hidden` and never got the
 * `table-cell` back, so it was invisible at *every* width rather than hidden
 * below one.
 *
 * It failed silently and looked like a design decision, which is what made it
 * survive review — the table simply had fewer columns than it should. Same
 * trap, and same fix, as `COLUMNS` in `SectionTabs`.
 */
const HIDDEN_BELOW = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const;

function hiddenClasses(hideBelow: TableColumn<unknown>['hideBelow']): string {
  return hideBelow ? HIDDEN_BELOW[hideBelow] : '';
}

function alignClass(align: TableColumn<unknown>['align']): string {
  return align === 'center'
    ? 'text-center'
    : align === 'right'
      ? 'text-right'
      : 'text-left';
}

export interface BaseTableProps<T> {
  title: string;
  subtitle?: string;
  data: T[];
  columns: TableColumn<T>[];
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
  emptyMessage,
  className = '',
  tableClassName,
  rowClassName,
  onRowClick,
  children,
  getRowKey,
}: BaseTableProps<T>) {
  // No loading or error branch: the page owns those now, through its Suspense
  // boundary and src/app/error.tsx. See agents/FRONTEND.md.
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
      {title && (
        <div>
          <h2 className='text-lg font-semibold text-white md:text-xl'>
            {title}
          </h2>
          {subtitle && <p className='mt-1 text-sm text-white/60'>{subtitle}</p>}
        </div>
      )}

      {children}

      <Card
        className={`overflow-hidden border-white/10 bg-[#2a0d33] ${tableClassName || ''}`}
      >
        {/* No scroll container. The table is `table-fixed` and every column
            width is a percentage, so it cannot be wider than the card — and a
            Radix `ScrollArea` wrapped round something that never overflows
            still mounts its scrollbars, which is where the grey bar under the
            board came from. */}
        <CardContent className='p-0'>
          <Table className='w-full table-fixed'>
            <TableHeader>
              <TableRow className='border-white/10 hover:bg-transparent'>
                {columns.map((column, index) => (
                  <TableHead
                    key={index}
                    className={cn(
                      TABLE_HEAD_CLASS,
                      alignClass(column.align),
                      column.width,
                      hiddenClasses(column.hideBelow),
                      column.className,
                    )}
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
                  className={cn(
                    TABLE_ROW_CLASS,
                    TABLE_ROW_HOVER_CLASS,
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(item, index),
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column, colIndex) => (
                    <TableCell
                      key={colIndex}
                      className={cn(
                        TABLE_CELL_CLASS,
                        alignClass(column.align),
                        hiddenClasses(column.hideBelow),
                        column.cellClassName?.(item, index),
                      )}
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
        </CardContent>
      </Card>
    </div>
  );
}
