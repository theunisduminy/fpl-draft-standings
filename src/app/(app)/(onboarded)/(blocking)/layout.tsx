import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/server/auth/server';

// Reads the session, so nothing beneath it can be prerendered.
export const dynamic = 'force-dynamic';

/**
 * Blocking gate for the one onboarded route that can 404.
 *
 * `players/[playerId]` calls `notFound()` for an unknown entry id. A
 * `<Suspense>` boundary above it — or a `loading.tsx` — would flush the
 * shell first and commit the HTTP status as 200 before `notFound()` runs.
 * This layout therefore awaits `getCurrentUser()` with no Suspense boundary
 * of its own, reproducing today's ordering (gate, then page existence check,
 * then first flush). Enforcement matches `<MembershipGate>`: null user or
 * incomplete profile redirects to `/profile`.
 *
 * Route groups are URL-neutral, so `/(blocking)/players/[playerId]` still
 * serves `/players/[playerId]`.
 */
export default async function BlockingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !user.profileComplete) redirect('/profile');

  return <>{children}</>;
}
