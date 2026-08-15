'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/server/auth/server';
import { upsertProfile } from '@/server/data/profiles';
import { isKnownTeamCode } from '@/utils/pl-teams';
import { parseTeamCode, type TeamCode } from '@/interfaces/fpl';

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
 *
 * All three of display name, bio and favourite club are compulsory, and this
 * is one of the two places that is true — `isProfileComplete` is the other,
 * and it decides who gets past the onboarding gate. Keep them in step: a field
 * required here but not there lets someone save a profile the gate then
 * bounces, and the reverse traps them on a form that will not accept anything.
 */
export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, error: 'You need to be signed in to do that.' };
  }

  const displayName = (formData.get('displayName') as string | null)?.trim();
  const bio = (formData.get('bio') as string | null)?.trim();

  // Both are compulsory, and this is where that is true. The `required`
  // attributes on the form are a convenience; `(onboarded)/layout.tsx` reads
  // the saved row, so a profile saved past the markup would just bounce back.
  if (!displayName) {
    return { ok: false, error: 'A display name is required.' };
  }

  if (!bio) {
    return { ok: false, error: 'A bio is required. Anything at all.' };
  }

  if (displayName.length > MAX_DISPLAY_NAME) {
    return {
      ok: false,
      error: `Display name must be ${MAX_DISPLAY_NAME} characters or fewer.`,
    };
  }

  if (bio.length > MAX_BIO) {
    return { ok: false, error: `Bio must be ${MAX_BIO} characters or fewer.` };
  }

  // Compulsory, like the two above, and it has to be real on top of that. A
  // `<select>` proves nothing: this is a POST endpoint and the body is whatever
  // the caller sent, so the code is checked against the ones upstream returned.
  const rawTeam = (formData.get('favouriteTeam') as string | null)?.trim();

  if (!rawTeam) {
    return { ok: false, error: 'Pick the club you support.' };
  }

  const favouriteTeam: TeamCode | null = parseTeamCode(rawTeam);

  if (!favouriteTeam || !(await isKnownTeamCode(favouriteTeam))) {
    return { ok: false, error: 'That is not a Premier League club.' };
  }

  await upsertProfile({ userId: user.id, displayName, bio, favouriteTeam });

  // The onboarding gate lives in a layout above every page, so a first save
  // changes what the whole app is allowed to render, not just this route.
  revalidatePath('/', 'layout');

  return { ok: true };
}
