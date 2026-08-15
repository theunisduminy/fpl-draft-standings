/**
 * One colour per manager, assigned by their position in the league entry list.
 *
 * A single list rather than a copy in each chart: the bump chart and the lead
 * ledger both draw the same eight people, and two lists would eventually give
 * one manager two colours on one page.
 *
 * Hex rather than theme tokens because these are series colours read by SVG
 * attributes, not utilities — the same reason `ChartConfig` takes hex. They are
 * deliberately eight distinguishable hues rather than a ramp of the brand
 * purple: the reader has to tell managers apart, not rank them.
 */
export const PLAYER_COLOURS = [
  '#facc15',
  '#00edfd',
  '#75fa95',
  '#f87171',
  '#c084fc',
  '#fb923c',
  '#60a5fa',
  '#4ade80',
] as const;

export function playerColour(index: number): string {
  return PLAYER_COLOURS[index % PLAYER_COLOURS.length];
}
