'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartCard } from '@/components/ChartCard';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { SeasonSnapshot } from '@/utils/scoring';
import { bumpSeries, seriesKey } from '@/utils/chart-scales';
import { nameFor as nameForEntry } from '@/utils/player-names';
import type { LeagueEntryId } from '@/interfaces/fpl';

/**
 * One colour per manager, by their position in the league entry list.
 *
 * Hex rather than theme tokens because these are series colours read by SVG
 * attributes, not utilities — the same reason `ChartConfig` takes hex. Eight
 * distinguishable hues rather than a ramp of the brand purple: the reader has
 * to tell managers apart, not rank them.
 *
 * It lives here, beside its only caller, rather than in a shared module. It
 * was briefly `@/utils/player-colours`, justified as stopping two charts from
 * inventing different palettes for the same eight people — but no second chart
 * ever consumed it (the form guide colours by finishing rank, not by manager).
 * Move it back out the day a second chart genuinely needs it.
 */
const PLAYER_COLOURS = [
  '#facc15',
  '#00edfd',
  '#75fa95',
  '#f87171',
  '#c084fc',
  '#fb923c',
  '#60a5fa',
  '#4ade80',
] as const;

function playerColour(index: number): string {
  return PLAYER_COLOURS[index % PLAYER_COLOURS.length];
}

type Mode = 'position' | 'gap';

/**
 * Two questions about one series. Position is the order, gap is the distance,
 * and the chart cannot show both at once: eight lines that never touch tell you
 * who is in front, and eight lines converging tell you it is close, but a line
 * cannot be at rank 2 and 14 points behind on the same axis.
 */
const MODES: { value: Mode; label: string }[] = [
  { value: 'position', label: 'Position' },
  { value: 'gap', label: 'Gap' },
];

/**
 * League position, gameweek by gameweek. Or the distance between everyone.
 *
 * This replaces two charts that were saying the same thing in different units:
 * podium race counted cumulative top-three finishes, position trajectory
 * plotted a running average rank, and both drew eight lines that climbed
 * together without ever showing who was actually in front. A bump chart does:
 * a line crossing another is an overtake, which is the only event in this
 * league worth drawing.
 *
 * Rank 1 sits at the top, so the axis is reversed. Without that the chart reads
 * upside down to anyone who has seen a league table.
 *
 * **Gap mode is the same eight lines against a different y.** Rank is an order
 * and hides every margin: first and second look identical whether the leader is
 * forty F1 points clear or two. Plotting each manager's deficit to that week's
 * leader shows the margin and loses the order, which is why it is a mode rather
 * than a replacement. It costs no new derivation — `SeasonPlace` already
 * carries a cumulative `f1_score`.
 *
 * Eight lines is a lot at GW38, so hovering a name in the key dims the rest.
 * The key is buttons rather than a recharts legend, because it has to be
 * reachable from the keyboard.
 *
 * In position mode each line also carries its owner's name at its right-hand
 * end. Labels on a line chart usually collide; they cannot there, because the
 * final point of every line is a distinct integer rank on an evenly spaced
 * axis. That is not true in gap mode — two managers level on F1 share a y — so
 * that mode drops the labels and leans on the key.
 *
 * **The aspect ratio is set here on purpose.** `ChartContainer`'s default is
 * now `aspect-video`, which is a reasonable chart and a poor bump chart: 38
 * gameweeks across eight rank steps wants to be wider and shorter than 16:9, or
 * the crossings pile up. The override is a preference, no longer a correction.
 */
export function PositionBumpChart({
  snapshots,
  playerNames,
}: {
  snapshots: SeasonSnapshot[];
  playerNames: Record<number, string>;
}) {
  const [focused, setFocused] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('position');
  const gap = mode === 'gap';

  // Every snapshot holds every manager, so the first one is the full cast.
  // Keyed by league entry, never by display name. Two managers sharing a
  // first name would collapse into one line, one legend entry and one tooltip
  // row — the chart quietly drawing seven people and calling it eight.
  const managers = (snapshots[0]?.places ?? []).map((place) => ({
    id: place.league_entry,
    key: seriesKey(place.league_entry),
    name: nameFor(playerNames, place.league_entry),
  }));

  // Memoised because `focused` changes on every legend hover, and a fresh
  // `chartData` identity makes recharts re-derive every axis, series and label
  // slot for what is only a change of stroke opacity.
  //
  // Built by `bumpSeries` rather than inline, so the key a point is written
  // under and the key a `<Line>` reads back come from the same function. When
  // they were written here by hand the two drifted apart, every series looked
  // up a key that did not exist, and the chart rendered with no lines while
  // typecheck, lint, the tests and the build all passed.
  const { points: chartData, deepest } = useMemo(
    () => bumpSeries(snapshots, mode),
    [snapshots, mode],
  );

  // The config carries the label, so the tooltip still shows a name even
  // though the series is keyed by id.
  const chartConfig = Object.fromEntries(
    managers.map((manager, index) => [
      manager.key,
      { label: manager.name, color: playerColour(index) },
    ]),
  ) satisfies ChartConfig;

  return (
    <ChartCard
      title={gap ? 'Gap to the leader' : 'Position by gameweek'}
      caption={
        gap
          ? 'F1 points behind the manager top of the table that week'
          : 'Where everyone stood in the table after each gameweek'
      }
      contentClassName='p-2 md:p-4'
      action={
        // `value && setMode(...)` is load-bearing: a single-select ToggleGroup
        // reports an empty string when the pressed item is pressed again, and
        // this control has no "neither" state — the chart must always be
        // showing one of the two.
        <ToggleGroup
          type='single'
          value={mode}
          onValueChange={(value) => value && setMode(value as Mode)}
          aria-label='Chart mode'
          // `w-fit`, because the card header stacks on a phone and the group
          // would otherwise stretch the full width with its two words marooned
          // in the middle. The rest mirrors `SectionTabs` deliberately: this is
          // a second set of tabs on the same page, and two tab languages on one
          // screen reads as two different apps.
          className='w-fit shrink-0 gap-0.5 self-start justify-self-start rounded-lg border border-border bg-card p-1'
        >
          {MODES.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              size='sm'
              aria-label={option.label}
              className='h-7 rounded-sm px-3 text-xs text-muted-foreground data-[state=on]:bg-gradient-to-t data-[state=on]:from-primary data-[state=on]:from-10% data-[state=on]:to-positive data-[state=on]:font-semibold data-[state=on]:text-primary-foreground'
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <ChartContainer
        config={chartConfig}
        className='aspect-[4/3] w-full sm:aspect-[2/1] md:aspect-[16/6] md:min-h-[320px]'
      >
        <LineChart
          data={chartData}
          margin={{ top: 10, right: gap ? 12 : 76, left: 0, bottom: 10 }}
        >
          <CartesianGrid vertical={false} stroke='rgba(255,255,255,0.06)' />
          <XAxis
            dataKey='event'
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            tickMargin={8}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            interval='preserveStartEnd'
          />
          {/* Position mode counts down, so the axis is reversed and ticked to
              the integers a league table uses. Gap mode is already negative
              below a leader pinned at zero, so a plain axis puts the leader on
              top without reversing anything. */}
          {gap ? (
            <YAxis
              domain={[deepest, 0]}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              width={38}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
          ) : (
            <YAxis
              reversed
              domain={[1, Math.max(managers.length, 1)]}
              ticks={managers.map((_, index) => index + 1)}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              width={28}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
          )}
          {/* Sorted into that gameweek's order, so the tooltip reads as the
              table stood that week rather than in whatever order the lines
              happen to be declared. Recharts' own `itemSorter` cannot do this:
              it is applied inside `DefaultTooltipContent`, so a custom
              `content` never sees it. */}
          <Tooltip
            content={({ active, label, payload }) => (
              // Named props rather than a spread: recharts' own `content`
              // prop would collide with the `content` attribute on the div
              // props `ChartTooltipContent` also accepts.
              <ChartTooltipContent
                active={active}
                label={label}
                // Best first in both modes, which means opposite sorts: rank 1
                // is the smallest number, but the smallest gap is the one
                // closest to zero, and every gap is negative.
                payload={[...(payload ?? [])].sort((a, b) =>
                  gap
                    ? Number(b.value) - Number(a.value)
                    : Number(a.value) - Number(b.value),
                )}
              />
            )}
          />
          {managers.map((manager, index) => (
            <Line
              key={manager.id}
              type='monotone'
              dataKey={manager.key}
              stroke={playerColour(index)}
              strokeWidth={focused === manager.key ? 3.5 : 2.5}
              strokeOpacity={
                focused === null || focused === manager.key ? 1 : 0.15
              }
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            >
              {!gap && (
                <LabelList
                  dataKey={manager.key}
                  content={(props) => (
                    <EndLabel
                      {...props}
                      name={manager.name}
                      lastIndex={chartData.length - 1}
                      dimmed={focused !== null && focused !== manager.key}
                    />
                  )}
                />
              )}
            </Line>
          ))}
        </LineChart>
      </ChartContainer>

      <div className='mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3'>
        {managers.map((manager, index) => (
          <button
            key={manager.id}
            type='button'
            onMouseEnter={() => setFocused(manager.key)}
            onMouseLeave={() => setFocused(null)}
            onFocus={() => setFocused(manager.key)}
            onBlur={() => setFocused(null)}
            className='flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
          >
            <span
              className='h-2.5 w-2.5 rounded-full'
              style={{ backgroundColor: playerColour(index) }}
            />
            {manager.name}
          </button>
        ))}
      </div>
    </ChartCard>
  );
}

/**
 * The manager's name, drawn once at the right-hand end of their line.
 *
 * `LabelList` offers every point, so all but the last are dropped here. The
 * geometry props arrive from recharts untyped in practice; they are narrowed
 * rather than typed as `any`, and a point without coordinates renders nothing.
 */
function EndLabel({
  x,
  y,
  index,
  name,
  lastIndex,
  dimmed,
}: {
  x?: string | number;
  y?: string | number;
  index?: number;
  name: string;
  lastIndex: number;
  dimmed: boolean;
}) {
  if (index !== lastIndex || x === undefined || y === undefined) return null;

  return (
    <text
      x={Number(x) + 8}
      y={Number(y)}
      dominantBaseline='middle'
      fontSize={11}
      fill={
        dimmed
          ? 'hsl(var(--foreground) / 0.15)'
          : 'hsl(var(--foreground) / 0.75)'
      }
    >
      {name.length > 9 ? `${name.slice(0, 8)}…` : name}
    </text>
  );
}

function nameFor(
  playerNames: Record<number, string>,
  entry: LeagueEntryId,
): string {
  return nameForEntry(playerNames, entry);
}
