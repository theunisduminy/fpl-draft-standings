import 'server-only';

import { eq } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { profiles, type ProfileRow } from '@/server/db/schema';

/**
 * Profiles link a Neon Auth user to their manager in the league.
 *
 * The league itself still comes from the FPL API — `league_entries` is the
 * roster. A profile only adds what upstream has no concept of: which signed-in
 * person is which manager, and whatever they choose to say about themselves.
 */

export async function getProfileByUserId(
  userId: string,
): Promise<ProfileRow | null> {
  const rows = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getProfileByLeagueEntry(
  leagueEntry: number,
): Promise<ProfileRow | null> {
  const rows = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.leagueEntry, leagueEntry))
    .limit(1);

  return rows[0] ?? null;
}

export async function listProfiles(): Promise<ProfileRow[]> {
  return getDb().select().from(profiles);
}

/**
 * Claim a league entry for the signed-in user, or update the profile they
 * already hold.
 *
 * `leagueEntry` is unique, so a second person cannot claim a manager that is
 * already taken — the insert fails rather than silently reassigning it.
 */
export async function upsertProfile(input: {
  userId: string;
  leagueEntry: number;
  displayName?: string | null;
  bio?: string | null;
}): Promise<ProfileRow> {
  const rows = await getDb()
    .insert(profiles)
    .values({
      userId: input.userId,
      leagueEntry: input.leagueEntry,
      displayName: input.displayName ?? null,
      bio: input.bio ?? null,
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        leagueEntry: input.leagueEntry,
        displayName: input.displayName ?? null,
        bio: input.bio ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return rows[0];
}
