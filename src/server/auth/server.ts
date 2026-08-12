import 'server-only';

import { createNeonAuth } from '@neondatabase/auth/next/server';

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

/**
 * The league is eight known people, so membership is an allowlist rather than
 * open sign-up.
 *
 * Checked server-side on every access, never in the UI: hiding a button is
 * presentation, this is the gate. Addresses are compared case-insensitively
 * because email casing is not meaningful.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((entry) => entry.toLowerCase());

  return allowed.includes(email.toLowerCase());
}

export type SignedInUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

/**
 * The signed-in user, or `null` — including when a real session belongs to an
 * address that is not on the allowlist. Callers therefore cannot accidentally
 * treat an unapproved session as approved; there is one answer to "who is
 * this?" and it already accounts for membership.
 */
export async function getCurrentUser(): Promise<SignedInUser | null> {
  const session = await auth.getSession();
  const user = session?.data?.user;

  if (!user?.email || !isAllowedEmail(user.email)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
  };
}
