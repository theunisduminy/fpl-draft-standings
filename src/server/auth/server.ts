import 'server-only';

import { createNeonAuth } from '@neondatabase/auth/next/server';

import { getLeagueMemberByEmail } from '@/server/data/league-members';

/**
 * Neon Auth (managed Better Auth). Identity lives in this project's own
 * `neon_auth` schema, which Neon owns and migrates — we read it, never define
 * it (see `src/server/db/schema.ts`).
 *
 * Sign-in is only needed for profiles and bets. The standings, results and
 * rumbler pages stay public and unauthenticated.
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
  leagueEntry: number;
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
 */
export async function getCurrentUser(): Promise<SignedInUser | null> {
  const session = await auth.getSession();
  const user = session?.data?.user;

  if (!user?.email) return null;

  const member = await getLeagueMemberByEmail(user.email);

  if (!member) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    leagueEntry: member.leagueEntry,
  };
}
