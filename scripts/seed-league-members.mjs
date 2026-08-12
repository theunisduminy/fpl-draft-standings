/**
 * Seed the curated email -> manager mapping.
 *
 *   pnpm db:seed:members
 *
 * Reads `league-members.json` from the repo root — gitignored, because it is a
 * list of real email addresses. Copy `league-members.example.json` and fill it
 * in. Re-running is safe: rows are upserted, never duplicated.
 *
 * The mapping is scoped to FPL_LEAGUE_ID, because both FPL identifiers are
 * season-scoped — so this needs re-running with fresh entry ids each August,
 * against the new league. Last season's rows stay put and are simply ignored.
 *
 * Membership is deliberately an administrative act rather than something a
 * member can do for themselves, so this is a script and not a page.
 */

import { readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

import { neon } from '@neondatabase/serverless';

try {
  loadEnvFile('.env.local');
} catch {
  // The variable may already be set in the environment.
}

const url = process.env.NEON_CONNECTION_STRING_PROD;
if (!url) {
  console.error('NEON_CONNECTION_STRING_PROD is not set.');
  process.exit(1);
}

// The mapping is per season, and the league id is the season identifier.
// Taken from the environment rather than the file so the roster cannot be
// seeded against a league the app is not actually reading.
const leagueId = Number(process.env.FPL_LEAGUE_ID);
if (!Number.isInteger(leagueId) || leagueId <= 0) {
  console.error('FPL_LEAGUE_ID is not set to a positive integer.');
  process.exit(1);
}

let mappings;
try {
  mappings = JSON.parse(readFileSync('league-members.json', 'utf8'));
} catch {
  console.error(
    'Could not read league-members.json.\n' +
      'Copy league-members.example.json to league-members.json and fill it in.',
  );
  process.exit(1);
}

if (!Array.isArray(mappings)) {
  console.error('league-members.json must be an array.');
  process.exit(1);
}

// Validate everything before writing anything — a half-applied roster is
// worse than a rejected one.
const seenEmails = new Set();
const seenEntries = new Set();

for (const [i, row] of mappings.entries()) {
  const where = `entry ${i + 1}`;
  if (
    typeof row?.email !== 'string' ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)
  ) {
    console.error(`${where}: "email" must be a valid email address.`);
    process.exit(1);
  }
  if (!Number.isInteger(row?.leagueEntry) || row.leagueEntry <= 0) {
    console.error(`${where}: "leagueEntry" must be a positive integer.`);
    process.exit(1);
  }
  const email = row.email.trim().toLowerCase();
  if (seenEmails.has(email)) {
    console.error(`${where}: duplicate email ${email}.`);
    process.exit(1);
  }
  if (seenEntries.has(row.leagueEntry)) {
    console.error(`${where}: duplicate leagueEntry ${row.leagueEntry}.`);
    process.exit(1);
  }
  seenEmails.add(email);
  seenEntries.add(row.leagueEntry);
}

const sql = neon(url);

for (const row of mappings) {
  const email = row.email.trim().toLowerCase();
  await sql`
    insert into league_members (league_id, email, league_entry)
    values (${leagueId}, ${email}, ${row.leagueEntry})
    on conflict (league_id, email)
      do update set league_entry = excluded.league_entry
  `;
  console.log(`  ${email} -> league entry ${row.leagueEntry}`);
}

const total = await sql`
  select count(*)::int as n from league_members where league_id = ${leagueId}
`;
console.log(
  `\n${mappings.length} mapped, ${total[0].n} members in league ${leagueId}.`,
);
