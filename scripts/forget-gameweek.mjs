/**
 * Delete a stored gameweek so the app refetches and re-scores it.
 *
 *   node --env-file=.env.local scripts/forget-gameweek.mjs <gameweek> [--prod]
 *
 * A gameweek in `gameweeks` is a claim that its result will never change again,
 * and the insert behind it is `onConflictDoNothing` — so a gameweek stored
 * wrongly cannot be corrected by any later run of the app. This is the escape
 * hatch, and it is a script rather than a page because it is an administrative
 * act on a table of facts.
 *
 * **Why it exists.** GW1 of 2026/27 was written on the Friday evening, before a
 * ball was kicked, as eight managers on zero points and joint first — paying
 * every one of them a win and 20 F1 points, permanently. Two upstream shapes
 * conspired: `/pl/event-status` has one row per *date*, so three of GW1's four
 * rows saying `leagues_updated` read as "gameweek complete"; and the live feed
 * lists every element on zero once the fixtures exist, so counting its keys
 * said "scored". Both are fixed in `season-state.ts` and `scoring.ts`, and
 * `rejectUnfinalisable` now refuses the write — but the row already written had
 * to be removed by hand.
 *
 * Defaults to the **sandbox** branch. `--prod` is required to touch production,
 * and the script prints what it is about to delete either way.
 */

import { neon } from '@neondatabase/serverless';

const args = process.argv.slice(2);
const useProd = args.includes('--prod');
const gameweek = Number(args.find((arg) => !arg.startsWith('--')));

if (!Number.isInteger(gameweek) || gameweek < 1 || gameweek > 38) {
  console.error(
    'Usage: node --env-file=.env.local scripts/forget-gameweek.mjs <gameweek> [--prod]',
  );
  process.exit(1);
}

const url = useProd
  ? process.env.NEON_CONNECTION_STRING_PROD
  : process.env.NEON_CONNECTION_STRING_SANDBOX;

const leagueId = Number(process.env.FPL_LEAGUE_ID);

if (!url) {
  console.error(
    `${useProd ? 'NEON_CONNECTION_STRING_PROD' : 'NEON_CONNECTION_STRING_SANDBOX'} is not set.`,
  );
  process.exit(1);
}

if (!Number.isInteger(leagueId) || leagueId <= 0) {
  console.error('FPL_LEAGUE_ID is not set to a positive integer.');
  process.exit(1);
}

const sql = neon(url);
const target = useProd ? 'PRODUCTION' : 'sandbox';

// Printed before deleting, not after. The rows are the only record of what was
// there, so a run that turns out to have been aimed at the wrong gameweek at
// least leaves the numbers in the terminal.
const rows = await sql`
  select league_entry, points, rank
  from gameweek_scores
  where league_id = ${leagueId} and gameweek = ${gameweek}
  order by rank
`;

if (rows.length === 0) {
  console.log(
    `No stored scores for GW${gameweek} in league ${leagueId} on ${target}. Nothing to do.`,
  );
  process.exit(0);
}

console.log(
  `About to delete GW${gameweek} for league ${leagueId} on ${target}:`,
);
console.table(rows);

await sql`
  delete from gameweek_scores
  where league_id = ${leagueId} and gameweek = ${gameweek}
`;

await sql`
  delete from gameweeks
  where league_id = ${leagueId} and gameweek = ${gameweek}
`;

console.log(
  `Deleted ${rows.length} score row(s) and unmarked GW${gameweek} as finalised.`,
);
console.log(
  'The next read recomputes it. Trigger one now with /api/cron/revalidate, or just load the site.',
);
