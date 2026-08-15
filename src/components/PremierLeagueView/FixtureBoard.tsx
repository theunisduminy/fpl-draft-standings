'use client';

import { useState } from 'react';

import { ClubCrest } from '@/components/ClubCrest';
import { GameweekSelector } from '@/components/GameweekSelector';
import { cn } from '@/lib/utils';
import type { GameweekFixtures, PlFixture } from '@/interfaces/premier-league';

/**
 * Fixtures and results, one gameweek at a time.
 *
 * A client component for the gameweek state only — all 38 weeks arrive as a
 * prop, already grouped and sorted on the server, so stepping between them is
 * instant and costs no request. That is the whole reason the page fetches all
 * 380 fixtures in one go rather than one gameweek at a time: Pulse returns the
 * lot in a single response, so paging it would be more calls for less.
 *
 * **Results and fixtures are the same object here, not two tabs.** A gameweek
 * in progress is half played, and splitting it would put the same round in two
 * places. The score column carries the state instead: a kick-off time before,
 * a live minute during, the score after.
 */
export function FixtureBoard({
  gameweeks,
  initialGameweek,
}: {
  gameweeks: GameweekFixtures[];
  /** Where to land: live, else next up, else the last. Decided on the server. */
  initialGameweek: number;
}) {
  const [selected, setSelected] = useState(initialGameweek);

  if (gameweeks.length === 0) {
    return (
      <p className='rounded-xl border border-border bg-card p-6 text-center text-sm text-white/60'>
        No fixtures have been published yet.
      </p>
    );
  }

  // A gameweek that vanished from upstream between render and click would
  // otherwise blank the list, so fall back to the first rather than to nothing.
  const current =
    gameweeks.find((week) => week.gameweek === selected) ?? gameweeks[0];

  return (
    <div className='space-y-4'>
      {/* The same pill strip the results page uses, rather than the prev/next
          pair this started with: 38 gameweeks is a lot of tapping to reach
          December, and the strip lets someone jump straight there. It is
          `GameweekSelector`, unchanged — a second scroller that looked almost
          like the first is exactly what the shared component exists to stop. */}
      <GameweekSelector
        gameweeks={gameweeks.map((week) => week.gameweek)}
        selectedGameweek={current.gameweek}
        onSelectGameweek={setSelected}
      />

      <p className='text-xs text-white/50'>{summarise(current.fixtures)}</p>

      <ul className='divide-y divide-border overflow-hidden rounded-xl border border-border bg-card'>
        {current.fixtures.map((fixture) => (
          <li key={fixture.id}>
            <FixtureRow fixture={fixture} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "10 fixtures", plus "· 3 live" or "· 6 played" once there is something to say. */
function summarise(fixtures: PlFixture[]): string {
  const played = fixtures.filter((fixture) => fixture.status === 'C').length;
  const live = fixtures.filter((fixture) => fixture.status === 'L').length;
  const count = `${fixtures.length} ${fixtures.length === 1 ? 'fixture' : 'fixtures'}`;

  if (live > 0) return `${count} · ${live} live`;
  if (played > 0) return `${count} · ${played} played`;

  return count;
}

function FixtureRow({ fixture }: { fixture: PlFixture }) {
  const played = fixture.homeScore !== null && fixture.awayScore !== null;

  return (
    <div className='flex items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4'>
      {/* Home: name then crest, so the two crests meet in the middle either
          side of the score, the way a fixture list reads on a screen. */}
      <div className='flex flex-1 items-center justify-end gap-2 text-right'>
        <span className={cn('truncate text-sm', outcomeWeight(fixture, 'H'))}>
          <span className='sm:hidden'>{fixture.home.abbr}</span>
          <span className='hidden sm:inline'>{fixture.home.shortName}</span>
        </span>
        <ClubCrest code={fixture.home.code} name={fixture.home.name} />
      </div>

      <Scoreline fixture={fixture} played={played} />

      <div className='flex flex-1 items-center gap-2'>
        <ClubCrest code={fixture.away.code} name={fixture.away.name} />
        <span className={cn('truncate text-sm', outcomeWeight(fixture, 'A'))}>
          <span className='sm:hidden'>{fixture.away.abbr}</span>
          <span className='hidden sm:inline'>{fixture.away.shortName}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The middle column: a score, a live minute, or a kick-off time.
 *
 * Fixed width so the crests either side line up down the list rather than
 * shuffling with the length of each label.
 */
function Scoreline({
  fixture,
  played,
}: {
  fixture: PlFixture;
  played: boolean;
}) {
  if (played) {
    return (
      <div className='flex w-20 shrink-0 flex-col items-center sm:w-24'>
        <span className='text-sm font-bold text-white tabular-nums'>
          {fixture.homeScore} – {fixture.awayScore}
        </span>
        {fixture.status === 'L' && fixture.clockLabel && (
          <span className='text-[10px] font-semibold text-[#75fa95]'>
            {fixture.clockLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className='flex w-20 shrink-0 flex-col items-center sm:w-24'>
      <span className='text-xs font-medium text-white/60 tabular-nums'>
        {kickoffTime(fixture)}
      </span>
      <span className='text-[10px] text-white/35'>{kickoffDay(fixture)}</span>
    </div>
  );
}

/**
 * Both halves come out of Pulse's own `"Sat 22 Aug 2026, 12:30 BST"`, split on
 * the comma, rather than from a `Date` — formatting the epoch here would render
 * the server's timezone on the first paint and the reader's after hydration,
 * which is a visible flip and a hydration warning. Pulse has already localised
 * it to UK time, which is the right zone for a Premier League kick-off anyway.
 */
function kickoffTime(fixture: PlFixture): string {
  const time = fixture.kickoffLabel?.split(', ')[1];

  return time ?? 'TBC';
}

function kickoffDay(fixture: PlFixture): string {
  const day = fixture.kickoffLabel?.split(', ')[0];

  return day ?? '';
}

/** The winning side is the one in white; the loser dims. */
function outcomeWeight(fixture: PlFixture, side: 'H' | 'A'): string {
  if (!fixture.outcome || fixture.status === 'U') return 'text-white/80';
  if (fixture.outcome === 'D') return 'text-white/80';

  return fixture.outcome === side
    ? 'font-semibold text-white'
    : 'text-white/45';
}
