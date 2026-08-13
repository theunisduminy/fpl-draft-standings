'use client';

import { useState, useTransition } from 'react';
import { Eye } from 'lucide-react';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { readGameweekSquad } from '@/server/actions/gameweek';
import type { GameweekSquad } from '@/utils/gameweek-squad';
import type { LeagueEntryId } from '@/interfaces/fpl';
import { cn } from '@/lib/utils';

/**
 * The team sheet behind a results row: who was fielded, and what each scored.
 *
 * The squad is fetched when the drawer opens, not with the page. A gameweek's
 * picks are eight upstream calls, and the reader may never ask for any of them
 * — so the cost is paid per click, and only once: `loadedGameweek` keys the
 * result on the gameweek, so re-opening the same one is free while switching
 * gameweeks refetches.
 *
 * It opens from the bottom on a phone and floats at the right on a desktop.
 * That is a vaul prop rather than a class, which is the only reason there is a
 * media query in JavaScript here.
 */
export function ViewTeamDrawer({
  leagueEntry,
  gameweek,
  playerName,
}: {
  leagueEntry: LeagueEntryId;
  gameweek: number;
  playerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [squad, setSquad] = useState<GameweekSquad | null>(null);
  const [loadedGameweek, setLoadedGameweek] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Matches Tailwind's `md`, the breakpoint the rest of this table changes at.
  const isDesktop = useMediaQuery('(min-width: 48rem)');

  function onOpenChange(next: boolean) {
    setOpen(next);

    if (!next || loadedGameweek === gameweek) return;

    setError(null);
    startTransition(async () => {
      const result = await readGameweekSquad(leagueEntry, gameweek);

      if (result.ok) {
        setSquad(result.squad);
        setLoadedGameweek(gameweek);
      } else {
        setError(result.error);
      }
    });
  }

  const starters = squad?.players.filter((player) => player.starting) ?? [];
  const bench = squad?.players.filter((player) => !player.starting) ?? [];
  const showSquad = loadedGameweek === gameweek && !pending;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={isDesktop ? 'right' : 'bottom'}
    >
      <button
        type='button'
        onClick={() => onOpenChange(true)}
        className='inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-white/70 transition-colors hover:border-[#00edfd]/50 hover:text-[#00edfd]'
      >
        <Eye className='h-3.5 w-3.5' />
        <span className='hidden md:inline'>View team</span>
        <span className='sr-only md:hidden'>View {playerName}&apos;s team</span>
      </button>

      <DrawerContent className='border-white/10 bg-[#1a0520] md:max-h-none'>
        <DrawerHeader className='border-b border-white/10 px-6 pt-2 pb-4 text-left md:pt-4'>
          <DrawerTitle className='text-white'>{playerName}</DrawerTitle>
          <DrawerDescription className='text-white/60'>
            Gameweek {gameweek} team sheet
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className='custom-scrollbar flex-1 overflow-y-auto'>
          <div className='space-y-6 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]'>
            {error && <p className='text-sm text-red-400'>{error}</p>}

            {!error && !showSquad && <SquadLoading />}

            {!error && showSquad && !squad && (
              <p className='text-sm text-white/50'>
                No team sheet for this gameweek.
              </p>
            )}

            {!error && showSquad && squad && (
              <>
                <div className='flex items-center justify-between rounded-lg bg-white/5 p-3'>
                  <div>
                    <p className='text-xs text-white/50'>Starting XI</p>
                    <p className='text-lg font-bold text-white'>
                      {squad.total} pts
                    </p>
                  </div>
                  <div className='text-right'>
                    <p className='text-xs text-white/50'>On the bench</p>
                    <p className='text-lg font-bold text-white/60'>
                      {squad.benchTotal} pts
                    </p>
                  </div>
                </div>

                <SquadList title='Starting XI' players={starters} />
                <SquadList title='Bench' players={bench} muted />
              </>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
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

/** Mirrors the loaded shape: the totals bar, then eleven rows. */
function SquadLoading() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-[68px] w-full rounded-lg' />
      <div className='space-y-2'>
        <Skeleton className='h-3 w-24' />
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className='flex items-center justify-between gap-3 py-2'>
            <div className='flex items-center gap-2'>
              <Skeleton className='h-5 w-11 shrink-0 rounded-md' />
              <div className='space-y-1.5'>
                <Skeleton className='h-3.5 w-28' />
                <Skeleton className='h-3 w-10' />
              </div>
            </div>
            <Skeleton className='h-3.5 w-6' />
          </div>
        ))}
      </div>
    </div>
  );
}
