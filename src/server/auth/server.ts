import 'server-only';

import { createNeonAuth } from '@neondatabase/auth/next/server';

import { getLeagueMemberByEmail } from '@/server/data/league-members';
import { getProfileByUserId, type ProfileRow } from '@/server/data/profiles';
import { asLeagueEntryId, type LeagueEntryId } from '@/interfaces/fpl';

/**
 * Neon Auth (managed Better Auth). Identity lives in this project's own
 * `neon_auth` schema, which Neon owns and migrates — we read it, never define
 * it (see `src/server/db/schema.ts`).
 *
 * **The whole app is behind sign-in**, enforced by `src/proxy.ts`. There is no
 * public view: a signed-out visitor only ever reaches `/auth/sign-in`.
 *
 * The proxy gate is authentication only — it knows a Neon session is valid, not
 * whether the person is in the league. Membership is this file's job, below.
 */
export const auth = createNeonAuth({
  baseUrl: requiredEnv('NEON_AUTH_BASE_URL'),
  cookies: {
    secret: requiredEnv('NEON_AUTH_COOKIE_SECRET'),
  },
});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. See .env.example — the base URL comes from your ` +
        "Neon project's Auth tab, and the secret from `openssl rand -base64 32`.",
    );
  }
  return value;
}

export type SignedInUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  /** Which manager they are, from the curated `league_members` mapping. */
  leagueEntry: LeagueEntryId;
  /**
   * Both a display name and a bio are on record. Onboarding is compulsory —
   * `src/app/(app)/(onboarded)/layout.tsx` sends anyone without these to
   * `/profile` and keeps them there.
   */
  profileComplete: boolean;
};

/**
 * The signed-in league member, or `null`.
 *
 * Membership is the `league_members` table: a session whose email has no row
 * there resolves to `null`, exactly like being signed out. Callers therefore
 * cannot accidentally treat a stranger's valid Google session as a member —
 * there is one answer to "who is this?" and it already accounts for both
 * authentication and membership.
 *
 * The manager comes back with the user because the mapping is the same lookup;
 * nothing downstream has to re-derive it, and nothing accepts it as input.
 *
 * The two reads run concurrently: membership decides whether there is a user at
 * all, and the profile only decides a flag on it, so there is nothing to gain
 * from doing them in sequence. This runs on every gated page, so it is one
 * round trip's worth of latency, not two.
 */
export async function getCurrentUser(): Promise<SignedInUser | null> {
  const session = await auth.getSession();
  const user = session?.data?.user;

  if (!user?.email) return null;

  const [member, profile] = await Promise.all([
    getLeagueMemberByEmail(user.email),
    getProfileByUserId(user.id),
  ]);

  if (!member) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    leagueEntry: asLeagueEntryId(member.leagueEntry),
    profileComplete: isProfileComplete(profile),
  };
}

/**
 * Both fields, both non-blank. Whitespace does not count as a bio, so the check
 * trims — otherwise a single space would satisfy the gate and the compulsory
 * part of compulsory onboarding would be one keystroke deep.
 */
function isProfileComplete(profile: ProfileRow | null): boolean {
  return Boolean(profile?.displayName?.trim() && profile?.bio?.trim());
}
