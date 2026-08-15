/**
 * The scales the standings cards paint with, as pure functions.
 *
 * These lived inside their components as module-local helpers, which put three
 * rules that decide what a reader believes about the league outside the reach
 * of a test. The review that moved them here found a defect in each: an
 * all-drawn head-to-head record shaded as the heaviest defeat, a tick scale
 * that could come back empty and leave a chart with no axis, and a heatmap that
 * paints every cell at maximum intensity on the first gameweek of a season.
 *
 * The rule is the same one `scoring.ts` states for the scoring layer: a rule
 * that only exists inside a component cannot be tested, and every rule in here
 * has already been wrong once. Anything that decides a colour or a scale from
 * data belongs here, with the test that pins it. Anything that decides a
 * `className` from that answer stays in the component.
 */

/** Steps on the heatmap ramp, 0 (never) through 5 (busiest cell). */
export const HEAT_LEVELS = 5;

/**
 * How much evidence an extreme colour needs before it is allowed.
 *
 * After one gameweek every pair in the league has met exactly once, so every
 * record is 1-0 or 0-1 and every ratio is 1 or 0. Banding on the ratio alone
 * therefore paints the whole grid solid green and red before anyone has played
 * a month, asserting a pecking order the data cannot support. Below this many
 * decisive meetings the outer bands are withheld and the colour tops out one
 * step in from each end.
 *
 * Five is a judgement, not a derivation: it is roughly a month of gameweeks,
 * and it is the point at which a 4-1 record starts to mean something. The
 * middle bands are unaffected, so a young season still shows its shape.
 */
export const MIN_DECISIVE_MEETINGS = 5;

/** Where one head-to-head record sits on the diverging scale. */
export type VersusBand = 'strong' | 'good' | 'even' | 'poor' | 'weak';

/**
 * Place a head-to-head record on the diverging scale.
 *
 * **Draws are not losses.** `buildHeadToHead` counts a tie as a draw, and a
 * test pins that; this function has to agree, or the grid contradicts the
 * scoring layer in the one place a reader actually looks. A record of nothing
 * but draws is `even`, and so is a pair who have never met — the same answer
 * for two different reasons, both of which mean "no advantage shown".
 *
 * The bands are deliberately wide around the middle. With a dozen meetings,
 * six-five is noise, and colouring it as an advantage invites people to read a
 * pattern that is not there.
 */
export function versusBand(
  won: number,
  drawn: number,
  lost: number,
): VersusBand {
  const decisive = won + lost;

  // No decisive meetings at all: either they have never met, or every meeting
  // was a draw. Neither is an advantage to anybody.
  if (decisive === 0) return 'even';

  const share = won / decisive;
  const proven = decisive >= MIN_DECISIVE_MEETINGS;

  if (share >= 0.7) return proven ? 'strong' : 'good';
  if (share >= 0.56) return 'good';
  if (share > 0.44) return 'even';
  if (share > 0.3) return 'poor';

  return proven ? 'weak' : 'poor';
}

/**
 * Map a count onto the heatmap ramp, scaled to the busiest cell in the grid.
 *
 * Zero is its own step rather than the bottom of the ramp: "never finished
 * here" is a different statement from "finished here least often", and the grid
 * is far easier to scan when the empties recede completely.
 *
 * `busiest` is the largest count anywhere in the grid, floored at
 * {@link MIN_DECISIVE_MEETINGS} rather than at 1. Flooring at 1 meant that on
 * the first gameweek of a season every manager's single finish was also the
 * busiest cell, so the entire grid lit up at full intensity and a season one
 * week old looked like a season of entrenched habits.
 */
export function heatStep(count: number, busiest: number): number {
  if (count <= 0) return 0;

  const scale = Math.max(MIN_DECISIVE_MEETINGS, busiest);

  return Math.min(
    HEAT_LEVELS,
    Math.max(1, Math.ceil((count / scale) * HEAT_LEVELS)),
  );
}

/**
 * Round numbers to label a shared scale with, always at least two of them.
 *
 * The scale is the only way to read a box plot, so an empty axis is not a
 * cosmetic failure: the chart still draws, and every distance in it becomes
 * unreadable. The stepped loop alone could return nothing — a range of 51 to 55
 * steps by 10 from 60, which is already past the end — so the step shrinks
 * through 10, 5 and 1 until the scale carries two labels, and falls back to the
 * two ends when even that does not.
 */
export function scaleTicks(floor: number, ceiling: number): number[] {
  if (
    !Number.isFinite(floor) ||
    !Number.isFinite(ceiling) ||
    ceiling <= floor
  ) {
    return [Math.round(floor)].filter(Number.isFinite);
  }

  const preferred = Math.max(10, Math.ceil((ceiling - floor) / 4 / 10) * 10);

  for (const step of [preferred, 10, 5, 1]) {
    const ticks: number[] = [];

    for (
      let tick = Math.ceil(floor / step) * step;
      tick <= ceiling;
      tick += step
    ) {
      ticks.push(tick);
    }

    if (ticks.length >= 2) return ticks;
  }

  return [Math.ceil(floor), Math.floor(ceiling)];
}
