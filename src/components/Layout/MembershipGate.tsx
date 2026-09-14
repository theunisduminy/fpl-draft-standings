import { requireOnboardedUser } from '@/server/auth/server';

/**
 * The membership check for everything in `(onboarded)`, suspended below the
 * `<Suspense>` boundary in `(onboarded)/layout.tsx` so AppChrome flushes
 * before this read resolves.
 *
 * Enforcement is the shared `requireOnboardedUser` predicate: a null user
 * (no session, or a session whose email has no `league_members` row) or an
 * incomplete profile redirects to `/profile`. See the layout comment for why
 * the group — and not a per-page check — owns this.
 *
 * Only `children`; no data fetching beyond the gate read. One
 * `getCurrentUser()` call per render path — pages that need the user for
 * display (e.g. squads picking its default tab) keep their own call inside
 * their own boundary.
 */
export async function MembershipGate({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOnboardedUser();

  return <>{children}</>;
}
