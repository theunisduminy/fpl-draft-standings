'use client';

import { useState, useTransition } from 'react';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { useMediaQuery } from '@/hooks/use-media-query';
import { readGameweekSquad } from '@/server/actions/gameweek';
import type { GameweekSquad } from '@/utils/gameweek-squad';
import type { LeagueEntryId } from '@/interfaces/fpl';
import { cn } from '@/lib/utils';

/** Which manager's team sheet to show, and whose name to title it with. */
export interface ViewTeamTarget {
  leagueEntry: LeagueEntryId;
  playerName: string;
}

export interface ViewTeam {
  target: ViewTeamTarget | null;
  gameweek: number;
  squad: GameweekSquad | null;
  loaded: boolean;
  error: string | null;
  open: (target: ViewTeamTarget) => void;
  close: () => void;
  retry: () => void;
}

/**
 * Own one table's team-sheet drawer: which manager is showing, and the squads
 * already read.
 *
 * A hook plus a single drawer, rather than a drawer per row. Each vaul root
 * registers window listeners whether or not it is open, so a drawer per row
 * meant eight of everything to show at most one panel — and eight private
 * caches that could never share a result.
 *
 * The read happens in `open`, an event handler, so there is no effect syncing
 * state to a fetch. Squads are cached by manager and gameweek: reopening one
 * already seen costs nothing, and switching gameweek reads afresh.
 */
export function useViewTeam(gameweek: number): ViewTeam {
  const [target, setTarget] = useState<ViewTeamTarget | null>(null);
  const [squads, setSquads] = useState<Map<string, GameweekSquad | null>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const key = target ? `${target.leagueEntry}:${gameweek}` : null;

  function read(next: ViewTeamTarget) {
    const nextKey = `${next.leagueEntry}:${gameweek}`;
    setError(null);

    startTransition(async () => {
      const result = await readGameweekSquad(next.leagueEntry, gameweek);

      if (result.ok) {
        setSquads((current) => new Map(current).set(nextKey, result.squad));
      } else {
        setError(result.error);
      }
    });
  }

  return {
    target,
    gameweek,
    squad: key ? (squads.get(key) ?? null) : null,
    loaded: key !== null && squads.has(key) && !pending,
    error,
    open: (next) => {
      setTarget(next);
      if (!squads.has(`${next.leagueEntry}:${gameweek}`)) read(next);
    },
    close: () => setTarget(null),
    retry: () => target && read(target),
  };
}

/**
 * The team sheet behind a results row: who was fielded, and what each scored.
 *
 * Bottom sheet on a phone, floating panel at the right on a desktop. That is a
 * vaul prop rather than a class, which is the only reason there is a media
 * query in JavaScript here.
 */
export function ViewTeamDrawer({ view }: { view: ViewTeam }) {
  // Matches Tailwind's `md`, the breakpoint the results table changes at.
  const isDesktop = useMediaQuery('(min-width: 48rem)');

  return (
    <Drawer
      open={view.target !== null}
      onOpenChange={(open) => !open && view.close()}
      direction={isDesktop ? 'right' : 'bottom'}
    >
      <DrawerContent className='border-white/10 bg-[#1a0520] md:max-h-none'>
        <DrawerHeader className='border-b border-white/10 px-6 pt-2 pb-4 text-left md:pt-4'>
          <DrawerTitle className='text-white'>
            {view.target?.playerName ?? 'Team sheet'}
          </DrawerTitle>
          <DrawerDescription className='text-white/60'>
            Gameweek {view.gameweek} team sheet
          </DrawerDescription>
        </DrawerHeader>

        {/* A plain scroll container, not a Radix `ScrollArea`. The primitive
            mounts a scrollbar of its own and `custom-scrollbar` painted a
            permanent 6px track behind it, so the sheet showed a grey rail down
            its edge whether or not there was anything to scroll. Native
            overflow gives the platform's overlay scrollbar instead: nothing
            until you scroll, then it fades away again. */}
        <div className='flex-1 overflow-y-auto'>
          <div className='space-y-6 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]'>
            <Body view={view} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * The four states, as an if-ladder.
 *
 * They are mutually exclusive and JSX `&&` has no `else`, so chaining them in
 * the markup means restating `!error &&` at every branch.
 */
function Body({ view }: { view: ViewTeam }) {
  if (view.error) {
    return <ErrorDisplay message={view.error} onRetry={view.retry} />;
  }
  if (!view.loaded) return <SquadLoading />;
  if (!view.squad) {
    return (
      <p className='text-sm text-white/50'>No team sheet for this gameweek.</p>
    );
  }

  const { players, total, benchTotal } = view.squad;

  return (
    <>
      <div className='flex items-center justify-between rounded-lg bg-white/5 p-3'>
        <div>
          <p className='text-xs text-white/50'>Starting XI</p>
          <p className='text-lg font-bold text-white'>{total} pts</p>
        </div>
        <div className='text-right'>
          <p className='text-xs text-white/50'>On the bench</p>
          <p className='text-lg font-bold text-white/60'>{benchTotal} pts</p>
        </div>
      </div>

      <SquadList
        title='Starting XI'
        players={players.filter((player) => player.starting)}
      />
      <SquadList
        title='Bench'
        players={players.filter((player) => !player.starting)}
        muted
      />
    </>
  );
}

function SquadList({
  title,
  players,
  muted = false,
}: {
  title: string;
  players: GameweekSquad['players'];
  muted?: boolean;
}) {
  if (players.length === 0) return null;

  return (
    <div className='space-y-2'>
      <h3 className='text-xs font-semibold tracking-wider text-white/40 uppercase'>
        {title}
      </h3>
      <ul className='divide-y divide-white/5'>
        {players.map((player) => (
          <li
            key={player.element}
            className='flex items-center justify-between gap-3 py-2'
          >
            <div className='flex min-w-0 items-center gap-2'>
              <Badge className='w-11 shrink-0 justify-center border-white/10 bg-white/5 text-[10px] text-white/60'>
                {player.position}
              </Badge>
              <div className='min-w-0'>
                <p
                  className={cn(
                    'truncate text-sm',
                    muted ? 'text-white/60' : 'text-white',
                  )}
                >
                  {player.name}
                </p>
                <p className='text-xs text-white/40'>{player.club}</p>
              </div>
            </div>
            <span
              className={cn(
                'shrink-0 text-sm font-bold',
                muted ? 'text-white/40' : 'text-white',
              )}
            >
              {player.points}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mirrors the loaded shape: the totals bar, then the starting eleven. */
function SquadLoading() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-[68px] w-full rounded-lg' />
      <div className='space-y-2'>
        <SkeletonText size='label' width='md' />
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className='flex items-center justify-between gap-3 py-2'>
            <div className='flex items-center gap-2'>
              <Skeleton className='h-5 w-11 shrink-0 rounded-md' />
              <div className='space-y-1.5'>
                <SkeletonText size='body' width='md' />
                <SkeletonText size='label' width='xs' />
              </div>
            </div>
            <SkeletonText size='body' width='xs' />
          </div>
        ))}
      </div>
    </div>
  );
}
