'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/server/auth/server';
import { getProfileByLeagueEntry, upsertProfile } from '@/server/data/profiles';
import { getGameweekData } from '@/utils/gameweek-data';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Claim a manager in the league for the signed-in user.
 *
 * A Server Action is a public POST endpoint, so nothing here trusts its
 * caller: the user comes from the session (never from the form), the league
 * entry is validated against the real roster, and an entry already claimed by
 * somebody else is rejected.
 */
export async function claimLeagueEntry(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, error: 'You need to be signed in to do that.' };
  }

  const leagueEntry = Number(formData.get('leagueEntry'));

  if (!Number.isInteger(leagueEntry) || leagueEntry <= 0) {
    return { ok: false, error: 'Pick a manager from the list.' };
  }

  // The roster is upstream's, not ours — check against it rather than
  // trusting whatever id the form posted.
  const { players } = await getGameweekData();

  if (!players.some((player) => player.id === leagueEntry)) {
    return { ok: false, error: 'That manager is not in this league.' };
  }

  const existing = await getProfileByLeagueEntry(leagueEntry);

  if (existing && existing.userId !== user.id) {
    return { ok: false, error: 'Someone has already claimed that manager.' };
  }

  const displayName = (formData.get('displayName') as string | null)?.trim();
  const bio = (formData.get('bio') as string | null)?.trim();

  await upsertProfile({
    userId: user.id,
    leagueEntry,
    displayName: displayName || user.name,
    bio: bio || null,
  });

  revalidatePath('/profile');

  return { ok: true };
}
