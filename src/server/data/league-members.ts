import 'server-only';

import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { leagueMembers, type LeagueMemberRow } from '@/server/db/schema';
import { getLeagueId } from '@/utils/fpl-api';

/**
 * The curated email -> manager mapping, per season.
 *
 * This table answers both "may this person sign in?" and "which manager are
 * they?", so there is no claim flow and nothing for a member to choose. See
 * the schema for why it is curated rather than self-service, and why it is
 * scoped by league (which is effectively a season).
 *
 * The email is the stable identity across seasons; the league entry is not.
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
    .where(
      and(
        eq(leagueMembers.leagueId, getLeagueId()),
        eq(leagueMembers.email, normalise(email)),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function listLeagueMembers(): Promise<LeagueMemberRow[]> {
  return getDb()
    .select()
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, getLeagueId()))
    .orderBy(asc(leagueMembers.leagueEntry));
}

/**
 * Add or re-point a mapping for the current season. Used by the seed script,
 * not by the app — membership is an administrative act, never a user-facing
 * one.
 */
export async function upsertLeagueMember(input: {
  email: string;
  leagueEntry: number;
}): Promise<LeagueMemberRow> {
  const leagueId = getLeagueId();

  const rows = await getDb()
    .insert(leagueMembers)
    .values({
      leagueId,
      email: normalise(input.email),
      leagueEntry: input.leagueEntry,
    })
    .onConflictDoUpdate({
      target: [leagueMembers.leagueId, leagueMembers.email],
      set: { leagueEntry: input.leagueEntry },
    })
    .returning();

  return rows[0];
}
