'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/server/auth/server';
import { upsertProfile } from '@/server/data/profiles';

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_DISPLAY_NAME = 60;
const MAX_BIO = 500;

/**
 * Update the signed-in member's own profile.
 *
 * A Server Action is a public POST endpoint, so nothing here trusts its
 * caller. The user comes from the session, and there is no manager field to
 * tamper with — which manager someone is comes from the curated
 * `league_members` mapping, so it is not an input to validate. It is not an
 * input at all.
 */
export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, error: 'You need to be signed in to do that.' };
  }

  const displayName = (formData.get('displayName') as string | null)?.trim();
  const bio = (formData.get('bio') as string | null)?.trim();

  if (displayName && displayName.length > MAX_DISPLAY_NAME) {
    return {
      ok: false,
      error: `Display name must be ${MAX_DISPLAY_NAME} characters or fewer.`,
    };
  }

  if (bio && bio.length > MAX_BIO) {
    return { ok: false, error: `Bio must be ${MAX_BIO} characters or fewer.` };
  }

  await upsertProfile({
    userId: user.id,
    displayName: displayName || user.name,
    bio: bio || null,
  });

  revalidatePath('/profile');

  return { ok: true };
}
