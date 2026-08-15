'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';

import { ClubCrest } from '@/components/ClubCrest';
import { BaseTable, type TableColumn } from '@/components/TableView/base-table';
import { cn } from '@/lib/utils';
import type { FormResult, LeagueTableRow } from '@/interfaces/premier-league';

/**
 * The Premier League table.
 *
 * Built on `BaseTable`, the same primitive the standings board uses, so the two
 * tables on this site share a row height, a hover shape and one way of hiding a
 * column at a breakpoint. It was briefly hand-rolled over the `ui/table`
 * primitives and that was the wrong call: it meant a second table on the site
 * that looked almost, but not quite, like the first.
 *
 * **Two column sets, one config.** A phone gets position, club, played, goal
 * difference and points, which is what anyone reads a table for. W/D/L appear
 * from `sm`, goals for and against from `md`, the form guide from `lg` — all
 * through `hideBelow`, which keeps each header and its cells in step.
 *
 * The qualification stripe is a left border on the first cell rather than a
 * border on the row: a `<tr>` border does not paint reliably under
 * `border-collapse`, and `BaseTable` gives per-cell classes for exactly this.
 */

/**
 * What each Pulse annotation means, and the colour it earns.
 *
 * **These four codes are observed, not guessed.** The 2024/25 table carries
 * `EU_CL` and `EU_UC`; the 2026/27 one carries `EU_CL`, `EU_EL` and `EN_CH`.
 * Relegation is `EN_CH` — the destination is the *English Championship*, not a
 * status called "relegated" — and the Conference League is `EU_UC`, not the
 * `EU_UECL` its own branding suggests. An unrecognised code renders no stripe
 * and no legend entry rather than a wrong one, which is why `railFor` looks the
 * code up instead of assuming.
 */
const ANNOTATION_STYLES: Record<
  string,
  { rail: string; swatch: string; label: string }
> = {
  EU_CL: {
    rail: 'border-l-[3px] border-l-[#00edfd]',
    swatch: 'bg-[#00edfd]',
    label: 'Champions League',
  },
  EU_EL: {
    rail: 'border-l-[3px] border-l-[#75fa95]',
    swatch: 'bg-[#75fa95]',
    label: 'Europa League',
  },
  EU_UC: {
    rail: 'border-l-[3px] border-l-[#75fa95]/60',
    swatch: 'bg-[#75fa95]/60',
    label: 'Conference League',
  },
  EN_CH: {
    rail: 'border-l-[3px] border-l-[#f87171]',
    swatch: 'bg-[#f87171]',
    label: 'Relegation',
  },
};

const FORM_STYLES: Record<FormResult, string> = {
  W: 'bg-[#75fa95]/20 text-[#75fa95]',
  D: 'bg-white/10 text-white/60',
  L: 'bg-[#f87171]/20 text-[#f87171]',
};

const FORM_LABELS: Record<FormResult, string> = {
  W: 'Won',
  D: 'Drew',
  L: 'Lost',
};

export function LeagueTable({ rows }: { rows: LeagueTableRow[] }) {
  const legend = visibleAnnotations(rows);

  return (
    <div className='space-y-3'>
      <BaseTable
        title=''
        data={rows}
        columns={leagueTableColumns()}
        emptyMessage='The table is not available right now.'
        getRowKey={(row) => row.club.code}
      />

      {legend.length > 0 && (
        <ul className='flex flex-wrap gap-x-4 gap-y-1.5'>
          {legend.map((note) => (
            <li
              key={note}
              className='flex items-center gap-2 text-xs text-white/50'
            >
              <span
                aria-hidden='true'
                className={cn(
                  'h-2.5 w-[3px] rounded-full',
                  ANNOTATION_STYLES[note].swatch,
                )}
              />
              {ANNOTATION_STYLES[note].label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function leagueTableColumns(): TableColumn<LeagueTableRow>[] {
  return [
    {
      header: '#',
      key: (row) => row.position,
      align: 'center',
      width: 'w-[12%] md:w-[7%]',
      // The stripe rides on this cell, so it lands at the left edge of the row.
      cellClassName: (row) => railFor(row) ?? '',
    },
    {
      header: 'Club',
      key: (row) => (
        <div className='flex items-center gap-2.5'>
          <ClubCrest code={row.club.code} name={row.club.name} />
          <span className='truncate font-medium text-white'>
            {/* "Nottingham Forest" needs seventeen characters; the short name
                is what a broadcast graphic uses and what fits a phone. */}
            <span className='sm:hidden'>{row.club.shortName}</span>
            <span className='hidden sm:inline'>{row.club.name}</span>
          </span>
          <Movement places={row.movement} />
        </div>
      ),
      width: 'w-[40%] md:w-[26%]',
    },
    numeric('P', (row) => row.played, 'w-[12%] md:w-[6%]'),
    numeric('W', (row) => row.won, 'md:w-[6%]', 'sm'),
    numeric('D', (row) => row.drawn, 'md:w-[6%]', 'sm'),
    numeric('L', (row) => row.lost, 'md:w-[6%]', 'sm'),
    numeric('GF', (row) => row.goalsFor, 'md:w-[6%]', 'md'),
    numeric('GA', (row) => row.goalsAgainst, 'md:w-[6%]', 'md'),
    numeric(
      'GD',
      (row) => `${row.goalDifference > 0 ? '+' : ''}${row.goalDifference}`,
      'w-[16%] md:w-[7%]',
    ),
    {
      header: 'Pts',
      key: (row) => row.points,
      align: 'center',
      width: 'w-[20%] md:w-[8%]',
      cellClassName: () => 'font-bold text-white tabular-nums',
    },
    {
      header: 'Form',
      key: (row) => <FormGuide form={row.form} club={row.club.name} />,
      width: 'lg:w-[16%]',
      hideBelow: 'lg',
    },
  ];
}

/** A right-aligned count column, which is most of this table. */
function numeric(
  header: string,
  read: (row: LeagueTableRow) => React.ReactNode,
  width: string,
  hideBelow?: 'sm' | 'md' | 'lg',
): TableColumn<LeagueTableRow> {
  return {
    header,
    key: read,
    align: 'center',
    width,
    hideBelow,
    cellClassName: () => 'text-white/70 tabular-nums',
  };
}

/** The border class for a row's first annotation, if it has one we know. */
function railFor(row: LeagueTableRow): string | null {
  for (const note of row.annotations) {
    const style = ANNOTATION_STYLES[note];

    if (style) return style.rail;
  }

  return null;
}

/** Only explain the markers actually on screen. */
function visibleAnnotations(rows: LeagueTableRow[]): string[] {
  const seen = new Set<string>();

  for (const row of rows) {
    for (const note of row.annotations) {
      if (ANNOTATION_STYLES[note]) seen.add(note);
    }
  }

  return [...seen];
}

function FormGuide({ form, club }: { form: FormResult[]; club: string }) {
  if (form.length === 0) {
    return <span className='text-xs text-white/30'>—</span>;
  }

  return (
    <div className='flex gap-1'>
      {form.map((result, index) => (
        <span
          // Form is a fixed-length ordered run of five letters with no id of
          // its own, and it re-renders wholesale on every refresh, so the index
          // is a stable enough key here.
          key={index}
          title={`${FORM_LABELS[result]} — ${club}`}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold',
            FORM_STYLES[result],
          )}
        >
          {result}
        </span>
      ))}
    </div>
  );
}

function Movement({ places }: { places: number | null }) {
  if (places === null || places === 0) return null;

  const up = places > 0;
  const Icon = up ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center text-[10px] font-semibold',
        up ? 'text-[#75fa95]' : 'text-[#f87171]',
      )}
    >
      <Icon className='h-3 w-3' aria-hidden='true' />
      <span className='sr-only'>
        {up ? 'Up' : 'Down'} {Math.abs(places)} since the gameweek began
      </span>
    </span>
  );
}
