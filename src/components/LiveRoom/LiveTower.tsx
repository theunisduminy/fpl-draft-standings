import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  LiveGameweekBadge,
  LiveGameweekNote,
} from '@/components/LiveGameweekBadge';
import { LIVE_TOWER_COLUMN_SHAPES } from '@/components/shapes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import RefreshControl from '../LiveRoom/RefreshControl';

/**
 * One manager's provisional line in the tower, in provisional rank order.
 *
 * A presentation shape, not the derivation: the numbers are computed in
 * `src/utils/live-tower.ts` and the live slice in `src/utils/live-gameweek.ts`
 * maps them into this. `interval` is the gap to the manager directly above (0
 * for first), `cushion` the gap above provisional last (0 for last), and
 * `done` plus `toPlay` count the XI starters who have registered minutes and
 * those still to come.
 */
export interface LiveTowerRow {
  position: number;
  managerName: string;
  teamName: string;
  points: number;
  interval: number;
  cushion: number;
  done: number;
  toPlay: number;
  movement: 'riser' | 'faller' | 'level';
}

/** The live board as the page hands it down: gameweek, stamp, ordered rows. */
export interface LiveTowerData {
  gameweek: number;
  /** Epoch millis stamped when the slice was shaped, rendered UK time. */
  computedAt: number;
  rows: LiveTowerRow[];
}

/**
 * The Sunday timing tower: eight managers in provisional order with the gap to
 * safety beside every name.
 *
 * A server component that receives its data as props. No fetch, no gateway
 * import, no `server-only` transitive dependency: the page reads the live
 * slice and this renders it. The only client boundary below is
 * `RefreshControl`, which owns the manual refresh interaction and nothing
 * else.
 *
 * Every figure on this board is provisional, and it says so three ways: the
 * badge above the board, a provisional tag on every points value, and the note
 * beside the freshness stamp. No provisional figure renders unlabeled.
 */
export function LiveTower({ data }: { data: LiveTowerData }) {
  const updatedAt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(data.computedAt));

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <LiveGameweekBadge gameweek={data.gameweek} />
        <RefreshControl />
      </div>

      <Card className='overflow-hidden border-border bg-card'>
        <CardContent className='p-0'>
          <Table className='w-full table-fixed'>
            <TableHeader>
              <TableRow className='border-border hover:bg-transparent'>
                <TableHead
                  className={cn(
                    TOWER_HEAD_CLASS,
                    LIVE_TOWER_COLUMN_SHAPES[0].width,
                  )}
                >
                  Manager
                </TableHead>
                <TableHead
                  className={cn(
                    TOWER_HEAD_CLASS,
                    LIVE_TOWER_COLUMN_SHAPES[1].width,
                    'text-center',
                  )}
                >
                  Points
                </TableHead>
                <TableHead
                  className={cn(
                    TOWER_HEAD_CLASS,
                    LIVE_TOWER_COLUMN_SHAPES[2].width,
                    'text-center',
                    hiddenBelowMd(LIVE_TOWER_COLUMN_SHAPES[2].hideBelow),
                  )}
                >
                  Interval
                </TableHead>
                <TableHead
                  className={cn(
                    TOWER_HEAD_CLASS,
                    LIVE_TOWER_COLUMN_SHAPES[3].width,
                    'text-center',
                    hiddenBelowMd(LIVE_TOWER_COLUMN_SHAPES[3].hideBelow),
                  )}
                >
                  Cushion
                </TableHead>
                <TableHead
                  className={cn(
                    TOWER_HEAD_CLASS,
                    LIVE_TOWER_COLUMN_SHAPES[4].width,
                    'text-center',
                  )}
                >
                  Starters
                </TableHead>
                <TableHead
                  className={cn(
                    TOWER_HEAD_CLASS,
                    LIVE_TOWER_COLUMN_SHAPES[5].width,
                    'text-center',
                  )}
                >
                  Form
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow
                  key={row.position + row.managerName}
                  className={TOWER_ROW_CLASS}
                >
                  <TableCell className={TOWER_CELL_CLASS}>
                    <div className='flex min-w-0 items-center gap-3'>
                      <LiveRankBadge rank={row.position} />
                      <div className='min-w-0'>
                        <div className='truncate font-medium text-foreground'>
                          {row.managerName}
                        </div>
                        <div className='truncate text-xs text-muted-foreground'>
                          {row.teamName}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={cn(TOWER_CELL_CLASS, 'text-center')}>
                    <span className='inline-flex flex-col items-center gap-1'>
                      <span className='text-base font-bold text-positive'>
                        {row.points}
                      </span>
                      <span className='inline-flex rounded-full border border-positive/40 bg-positive/10 px-2 py-0.5 text-[10px] font-medium text-positive'>
                        Provisional
                      </span>
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      TOWER_CELL_CLASS,
                      'text-center',
                      hiddenBelowMd(LIVE_TOWER_COLUMN_SHAPES[2].hideBelow),
                    )}
                  >
                    {row.interval}
                    <span className='sr-only'>
                      points behind the manager above
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      TOWER_CELL_CLASS,
                      'text-center',
                      hiddenBelowMd(LIVE_TOWER_COLUMN_SHAPES[3].hideBelow),
                    )}
                  >
                    {row.cushion}
                    <span className='sr-only'>
                      points above provisional last
                    </span>
                  </TableCell>
                  <TableCell className={cn(TOWER_CELL_CLASS, 'text-center')}>
                    {row.done} done, {row.toPlay} to play
                  </TableCell>
                  <TableCell className={cn(TOWER_CELL_CLASS, 'text-center')}>
                    <MovementMarker movement={row.movement} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className='space-y-1'>
        <p className='text-xs text-muted-foreground'>
          Figures updated {updatedAt} UK time.
        </p>
        <LiveGameweekNote gameweek={data.gameweek} />
      </div>
    </div>
  );
}

/**
 * Header and cell rhythm for the tower.
 *
 * Restated here rather than imported from `base-table.tsx`: that module is
 * `'use client'`, and a server component reading strings out of it resolves
 * them through the client reference machinery (see `shapes.ts`). Same values
 * by construction, kept in step by the eye check, with semantic tokens rather
 * than the board's hard coded purples.
 */
const TOWER_HEAD_CLASS =
  'px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-muted-foreground md:px-4';

const TOWER_CELL_CLASS = 'px-3 py-3 text-sm text-foreground md:px-4';

/** Row floor without dividers or hover: tower rows are not clickable. */
const TOWER_ROW_CLASS = 'h-14 border-0';

/**
 * The column the real table hides below `md`, or nothing.
 *
 * A literal lookup, because Tailwind reads the source: a class assembled at
 * runtime generates no rule (see `base-table.tsx`). Only `md` is used today;
 * anything else renders visible rather than guessing a breakpoint.
 */
function hiddenBelowMd(hideBelow: 'sm' | 'md' | 'lg' | undefined): string {
  if (hideBelow === 'md') return 'hidden md:table-cell';
  return '';
}

/**
 * The league's rank palette, mirrored from `getRankBadgeClasses` in
 * `table-configs.tsx`.
 *
 * Local rather than imported: that module sits beside a `'use client'` table
 * and pulls the button primitive with it, which is exactly the drag
 * `shapes.ts` exists to stop. Five literal lines, kept in step with the
 * canonical helper by review.
 */
function liveRankBadgeClasses(rank: number): string {
  if (rank === 1)
    return 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30';
  if (rank === 2) return 'bg-gray-300/20 text-gray-300 border-gray-300/30';
  if (rank === 3) return 'bg-amber-600/20 text-amber-500 border-amber-600/30';
  if (rank === 8) return 'bg-red-600/20 text-red-400 border-red-600/30';
  return 'bg-white/10 text-white/70 border-white/20';
}

function LiveRankBadge({ rank }: { rank: number }) {
  return (
    <Badge
      variant='outline'
      className={cn(
        'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border p-0 text-sm font-bold',
        liveRankBadgeClasses(rank),
      )}
    >
      {rank}
    </Badge>
  );
}

/** State picks a whole class from a literal map, never a built string. */
const MOVEMENT_BADGE_CLASSES = {
  riser: 'border-positive/40 bg-positive/10 text-positive',
  faller: 'border-negative/40 bg-negative/10 text-negative',
  level: 'border-border bg-muted text-muted-foreground',
} as const;

const MOVEMENT_LABEL = {
  riser: 'Riser',
  faller: 'Faller',
  level: 'Level',
} as const;

/**
 * Riser, faller, or level against the settled season rank entering the
 * gameweek. Performing above station reads as a riser.
 */
function MovementMarker({ movement }: { movement: LiveTowerRow['movement'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        MOVEMENT_BADGE_CLASSES[movement],
      )}
    >
      {movement === 'riser' ? (
        <ArrowUp className='h-3 w-3' aria-hidden='true' />
      ) : movement === 'faller' ? (
        <ArrowDown className='h-3 w-3' aria-hidden='true' />
      ) : (
        <Minus className='h-3 w-3' aria-hidden='true' />
      )}
      {MOVEMENT_LABEL[movement]}
      <span className='sr-only'>against settled season rank</span>
    </span>
  );
}
