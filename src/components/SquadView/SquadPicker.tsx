'use client';

import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SquadCard } from '@/components/SquadView/SquadCard';
import type { LeagueEntryId } from '@/interfaces/fpl';
import type { Squad } from '@/utils/squads';

/**
 * Radix rejects an empty string as an item value, so "compare against nobody"
 * needs a sentinel — the same trick the profile form uses for "no allegiance".
 */
const NONE = 'none';

/**
 * One squad, with an optional second beside it.
 *
 * Eight squads at once was eight scrolls of 15 rows nobody read. A squad is
 * only interesting next to the question you brought — "what has he got up
 * front?" — so the page asks which one, and the second column answers the only
 * follow-up worth building UI for.
 *
 * Every squad is already in memory: the page fetched them all server-side in
 * one go, so switching manager is a state change, not a round trip. This
 * renders; it never fetches.
 */
export function SquadPicker({
  squads,
  /** Whose squad to open on — the signed-in manager's, when they have one. */
  initialLeagueEntry,
}: {
  squads: Squad[];
  initialLeagueEntry?: LeagueEntryId;
}) {
  const initial =
    squads.find((squad) => squad.leagueEntry === initialLeagueEntry) ??
    squads[0];

  // The compare column opens on whoever is top of the league — `squads` is in
  // league order — because that is the squad everybody measures theirs
  // against. If you are top, it opens on second instead, since comparing a
  // squad with itself shows nothing.
  const opponent =
    squads.find((squad) => squad.leagueEntry !== initial?.leagueEntry) ??
    squads[0];

  const [left, setLeft] = useState(String(initial?.leagueEntry ?? ''));
  const [right, setRight] = useState(String(opponent?.leagueEntry ?? NONE));

  const leftSquad = squads.find((squad) => String(squad.leagueEntry) === left);
  const rightSquad = squads.find(
    (squad) => String(squad.leagueEntry) === right,
  );

  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
      <div className='space-y-3'>
        <ManagerSelect
          value={left}
          onChange={setLeft}
          squads={squads}
          label='Squad'
        />
        {leftSquad && <SquadCard squad={leftSquad} />}
      </div>

      <div className='space-y-3'>
        <ManagerSelect
          value={right}
          onChange={setRight}
          squads={squads}
          label='Compare with'
          clearable
        />
        {rightSquad ? (
          <SquadCard squad={rightSquad} />
        ) : (
          <p className='rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/40'>
            Choose a manager to compare against.
          </p>
        )}
      </div>
    </div>
  );
}

function ManagerSelect({
  value,
  onChange,
  squads,
  label,
  clearable = false,
}: {
  value: string;
  onChange: (value: string) => void;
  squads: Squad[];
  label: string;
  /** Offer a way back to nobody. Only the compare column wants one. */
  clearable?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className='h-auto w-full rounded-md border-white/15 bg-[#2a0d33] px-3 py-2.5 text-base text-white md:text-sm'
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className='border-white/20 bg-[#1a0520]'>
        {clearable && (
          <SelectItem
            value={NONE}
            className='text-white/60 focus:bg-white/10 focus:text-white'
          >
            Nobody
          </SelectItem>
        )}
        {squads.map((squad) => (
          <SelectItem
            key={squad.leagueEntry}
            value={String(squad.leagueEntry)}
            className='text-white focus:bg-white/10 focus:text-white'
          >
            <span className='flex min-w-0 flex-col items-start'>
              <span className='truncate'>{squad.teamName}</span>
              <span className='text-xs text-white/40'>{squad.managerName}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
