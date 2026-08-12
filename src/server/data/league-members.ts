import 'server-only';

import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { leagueMembers, type LeagueMemberRow } from '@/server/db/schema';

/**
 * The curated email -> manager mapping.
 *
 * This table answers both "may this person sign in?" and "which manager are
 * they?", so there is no claim flow and nothing for a member to choose. See
 * the schema for why it is curated rather than self-service.
 */

/** Emails are stored lowercased; always look up through this. */
function normalise(email: string): string {
  return email.trim().toLowerCase();
}

export async function getLeagueMemberByEmail(
  email: string,
): Promise<LeagueMemberRow | null> {
  const rows = await getDb()
    .select()
    .from(leagueMembers)
    .where(eq(leagueMembers.email, normalise(email)))
    .limit(1);

  return rows[0] ?? null;
}

export async function listLeagueMembers(): Promise<LeagueMemberRow[]> {
  return getDb()
    .select()
    .from(leagueMembers)
    .orderBy(asc(leagueMembers.leagueEntry));
}

/**
 * Add or re-point a mapping. Used by the seed script, not by the app —
 * membership is an administrative act, never a user-facing one.
 */
export async function upsertLeagueMember(input: {
  email: string;
  leagueEntry: number;
}): Promise<LeagueMemberRow> {
  const rows = await getDb()
    .insert(leagueMembers)
    .values({ email: normalise(input.email), leagueEntry: input.leagueEntry })
    .onConflictDoUpdate({
      target: leagueMembers.email,
      set: { leagueEntry: input.leagueEntry },
    })
    .returning();

  return rows[0];
}
