/**
 * Seed the sandbox Neon branch with played gameweeks.
 *
 * The real season has not kicked off, so every screen renders its empty state
 * and there is nothing to design against. This fills a branch with a plausible
 * part-season so the standings, results, rumbler and player views can be built
 * against data that behaves like the real thing.
 *
 *   node --env-file=.env.local scripts/seed-sandbox-gameweeks.mjs [gameweeks]
 *
 * Defaults to 10 gameweeks. Re-running is safe: it clears the seeded rows for
 * the league first, so the output is stable rather than accumulating.
 *
 * **It refuses to run against production.** `NEON_CONNECTION_STRING_SANDBOX`
 * must be set and must point at a different host from
 * `NEON_CONNECTION_STRING_PROD`. Seeding invented scores into the real season
 * would be indistinguishable from the fabricated-standings bug this codebase
 * already had once.
 */

import { neon } from '@neondatabase/serverless';

const DEFAULT_GAMEWEEKS = 10;

const sandboxUrl = process.env.NEON_CONNECTION_STRING_SANDBOX;
const prodUrl = process.env.NEON_CONNECTION_STRING_PROD;
const leagueId = Number(process.env.FPL_LEAGUE_ID);

function hostOf(url) {
  const match = url?.match(/@([^/]+)/);
  return match ? match[1] : null;
}

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

if (!sandboxUrl) {
  fail(
    'NEON_CONNECTION_STRING_SANDBOX is not set. This script only ever writes to the sandbox branch.',
  );
}
if (!Number.isInteger(leagueId) || leagueId <= 0) {
  fail('FPL_LEAGUE_ID is not set to a positive integer.');
}
if (prodUrl && hostOf(sandboxUrl) === hostOf(prodUrl)) {
  fail(
    `The sandbox and prod connection strings point at the same host (${hostOf(sandboxUrl)}). ` +
      'Refusing to seed — check you copied the branch string, not the prod one.',
  );
}

const gameweekCount = Number(process.argv[2] ?? DEFAULT_GAMEWEEKS);
if (
  !Number.isInteger(gameweekCount) ||
  gameweekCount < 1 ||
  gameweekCount > 38
) {
  fail(
    `Gameweeks must be an integer between 1 and 38, received "${process.argv[2]}".`,
  );
}

const sql = neon(sandboxUrl);

/**
 * Deterministic pseudo-random in [0, 1) from two integers.
 *
 * Seeded rather than `Math.random()` so re-running produces the same season —
 * a screenshot taken today still matches the data tomorrow, and a bug found
 * against a given gameweek stays reproducible.
 */
function rand(a, b) {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Sum of 3 uniforms ≈ normal. Keeps scores clustered, with real tails. */
function scoreFor(leagueEntry, gameweek, skill) {
  const noise =
    rand(leagueEntry, gameweek) +
    rand(leagueEntry + 7, gameweek * 3) +
    rand(leagueEntry * 5, gameweek + 11);
  // ~52 average, most weeks 30-75, occasionally either side.
  return Math.max(12, Math.round(52 + skill + (noise - 1.5) * 26));
}

/** Ties share the better rank, exactly as `assignRanks` does in the app. */
function assignRanks(rows) {
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  let currentRank = 1;

  return sorted.map((row, index) => {
    if (index > 0 && row.points !== sorted[index - 1].points) {
      currentRank = index + 1;
    }
    return { ...row, rank: currentRank };
  });
}

const members = await sql`
  select league_entry from league_members where league_id = ${leagueId} order by league_entry
`;

if (members.length === 0) {
  fail(`No league_members rows for league ${leagueId} in the sandbox branch.`);
}

const entries = members.map((row) => row.league_entry);

// A fixed per-manager offset so the season table has a believable spread
// rather than eight identical managers. Derived from the ID, so it is stable.
const skill = new Map(
  entries.map((entry) => [entry, (rand(entry, 999) - 0.5) * 14]),
);

console.log(`\n  Seeding ${gameweekCount} gameweeks for league ${leagueId}`);
console.log(`  Target: ${hostOf(sandboxUrl)}`);
console.log(`  Managers: ${entries.length}\n`);

await sql`delete from gameweek_scores where league_id = ${leagueId}`;
await sql`delete from gameweeks where league_id = ${leagueId}`;

const totals = new Map(entries.map((entry) => [entry, { points: 0, f1: 0 }]));
const F1_POINTS = [20, 15, 12, 10, 8, 6, 4, 2];

for (let gameweek = 1; gameweek <= gameweekCount; gameweek++) {
  const scored = assignRanks(
    entries.map((entry) => ({
      leagueEntry: entry,
      points: scoreFor(entry, gameweek, skill.get(entry)),
    })),
  );

  for (const row of scored) {
    await sql`
      insert into gameweek_scores (league_id, gameweek, league_entry, points, rank)
      values (${leagueId}, ${gameweek}, ${row.leagueEntry}, ${row.points}, ${row.rank})
      on conflict do nothing
    `;
    const total = totals.get(row.leagueEntry);
    total.points += row.points;
    total.f1 += F1_POINTS[row.rank - 1] ?? 0;
  }

  await sql`
    insert into gameweeks (league_id, gameweek) values (${leagueId}, ${gameweek})
    on conflict do nothing
  `;

  const line = scored
    .map((row) => `${row.leagueEntry}:${row.points}`)
    .join('  ');
  console.log(`  GW${String(gameweek).padStart(2)}  ${line}`);
}

console.log('\n  Season totals (F1 score, points):');
[...totals.entries()]
  .sort((a, b) => b[1].f1 - a[1].f1)
  .forEach(([entry, total], index) => {
    console.log(
      `   ${String(index + 1).padStart(2)}. ${entry}   F1 ${String(total.f1).padStart(3)}   ${total.points} pts`,
    );
  });

console.log(
  `\n  Done. ${gameweekCount * entries.length} scores across ${gameweekCount} gameweeks.\n`,
);
