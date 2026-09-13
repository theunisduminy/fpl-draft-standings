import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  LiveGameweekBadge,
  LiveGameweekNote,
} from '@/components/LiveGameweekBadge';
import {
  LIVE_TOWER_COLUMN_SHAPES,
  liveTowerHiddenClass,
  rankBadgeClasses,
  TOWER_CELL_CLASS,
  TOWER_HEAD_CLASS,
  TOWER_ROW_CLASS,
} from '@/components/shapes';
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
 * Every figure on this board is provisional, and it says so two ways: the
 * badge above the board and the note beside the freshness stamp. No provisional figure renders unlabeled.
 */
/** UK-time stamp for the freshness line, built once. */
const UPDATED_AT_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function LiveTower({ data }: { data: LiveTowerData }) {
  const updatedAt = UPDATED_AT_FORMAT.format(new Date(data.computedAt));

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
                    liveTowerHiddenClass(2),
                  )}
                >
                  Interval
                </TableHead>
                <TableHead
                  className={cn(
                    TOWER_HEAD_CLASS,
                    LIVE_TOWER_COLUMN_SHAPES[3].width,
                    'text-center',
                    liveTowerHiddenClass(3),
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
                    <span className='text-base font-bold text-positive'>
                      {row.points}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      TOWER_CELL_CLASS,
                      'text-center',
                      liveTowerHiddenClass(2),
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
                      liveTowerHiddenClass(3),
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

function LiveRankBadge({ rank }: { rank: number }) {
  return (
    <Badge
      variant='outline'
      className={cn(
        'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border p-0 text-sm font-bold',
        rankBadgeClasses(rank),
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
