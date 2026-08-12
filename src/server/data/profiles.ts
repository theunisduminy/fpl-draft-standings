import 'server-only';

import { inArray } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { profiles, type ProfileRow } from '@/server/db/schema';

/**
 * The parts of a profile its owner controls — display name and bio.
 *
 * Which manager someone is is **not** here: that comes from the curated
 * `league_members` mapping via their session email. See
 * `src/server/data/league-members.ts`.
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

export async function getProfilesByUserIds(
  userIds: string[],
): Promise<ProfileRow[]> {
  if (userIds.length === 0) return [];

  return getDb()
    .select()
    .from(profiles)
    .where(inArray(profiles.userId, userIds));
}

export async function upsertProfile(input: {
  userId: string;
  displayName?: string | null;
  bio?: string | null;
}): Promise<ProfileRow> {
  const rows = await getDb()
    .insert(profiles)
    .values({
      userId: input.userId,
      displayName: input.displayName ?? null,
      bio: input.bio ?? null,
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        displayName: input.displayName ?? null,
        bio: input.bio ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return rows[0];
}
