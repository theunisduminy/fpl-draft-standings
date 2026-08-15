import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { getCurrentUser, type SignedInUser } from '@/server/auth/server';
import { getProfileByUserId } from '@/server/data/profiles';
import { getGameweekData } from '@/utils/gameweek-data';
import { getPremierLeagueTeams } from '@/utils/pl-teams';
import { buildPlayerProfile } from '@/utils/player-profile';
import { asTeamCode } from '@/interfaces/fpl';
import { cn } from '@/lib/utils';
import { ClubCrest } from '@/components/ClubCrest';
import { AuthPanel } from '@/components/Profile/AuthPanel';
import { ProfileForm } from '@/components/Profile/ProfileForm';
import { ProfileSkeleton } from '@/components/Profile/ProfileSkeleton';
import { SkeletonRegion } from '@/components/SkeletonRegion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageShell } from '@/components/Layout/PageShell';

export const metadata: Metadata = { title: 'Profile' };

// Reads the session, so it can never be prerendered.
export const dynamic = 'force-dynamic';

/**
 * The profile page, and the onboarding step.
 *
 * It sits in `(app)` but outside `(onboarded)`, so it is the one gated page
 * reachable without a finished profile — which is what makes it a viable
 * redirect target for the onboarding gate. See `(onboarded)/layout.tsx`.
 *
 * The layout matches every other page: `PageShell` heading on the left, content
 * below it, the width owned by `AppChrome`.
 *
 * **Only the session is awaited here.** It is two database reads, and both the
 * heading and the not-a-member branch turn on it. Everything expensive — the
 * season, the club list, the stored profile — is awaited inside `ProfileBody`,
 * behind the Suspense boundary, so the heading is not held up by a season read
 * that can be 344 upstream calls. This page used to await all four before
 * rendering anything at all, which made it the one page in the app where the
 * title waited on the FPL API.
 *
 * **There is no `loading.tsx`, and that is not an oversight.** Its title is the
 * one title on the site that is not a static string: `'Finish your profile'`
 * for someone onboarding, `'Your profile'` for everyone else. A route shell
 * cannot know which, and guessing means a visible flip from one heading to the
 * other a moment after paint — worse than the short wait on a session read.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  // Not "signed out" — `src/proxy.ts` redirects those to /auth/sign-in before
  // this renders. This is a valid Google session with no `league_members` row:
  // authenticated, but not one of us.
  if (!user) {
    return (
      <PageShell
        title='Not on the league list'
        subtitle='Profiles are for the managers in this league'
      >
        <Card className='max-w-4xl border-white/10 bg-[#2a0d33]'>
          <CardContent className='space-y-4 pt-4 md:pt-6'>
            <p className='text-sm text-white/60'>
              You are signed in, but your address is not mapped to a manager
              yet. Ask the league admin to add you, or sign out and try another
              Google account.
            </p>
            <AuthPanel signedIn />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const onboarding = !user.profileComplete;

  return (
    <PageShell
      title={onboarding ? 'Finish your profile' : 'Your profile'}
      subtitle={
        onboarding
          ? 'A display name, a bio and your club, and the league is yours'
          : user.email
      }
    >
      <Suspense
        fallback={
          <SkeletonRegion>
            <ProfileSkeleton />
          </SkeletonRegion>
        }
      >
        <ProfileBody user={user} onboarding={onboarding} />
      </Suspense>
    </PageShell>
  );
}

/**
 * Everything the page needs a read for: the identity cards, the form and the
 * season summary.
 *
 * `onboarding` is passed down rather than re-derived, so the heading above the
 * boundary and the form below it cannot disagree about which of the two states
 * this page is in.
 */
async function ProfileBody({
  user,
  onboarding,
}: {
  user: SignedInUser;
  onboarding: boolean;
}) {
  const [season, profile, teams] = await Promise.all([
    getGameweekData(),
    getProfileByUserId(user.id),
    getPremierLeagueTeams(),
  ]);

  const manager = season.players.find(
    (player) => player.id === user.leagueEntry,
  );

  // Pure, and over data this page already has — the season summary costs a
  // reduce, not a round trip. Same function the `/players/[playerId]` page uses,
  // so the two can never disagree about what a rumbler count is.
  const stats = buildPlayerProfile(season, user.leagueEntry)?.stats;
  const played = stats && stats.totalGameweeks > 0;
  const favouriteTeam = profile?.favouriteTeam
    ? asTeamCode(profile.favouriteTeam)
    : null;
  const club = teams.find((team) => team.code === favouriteTeam);

  return (
    // Four facts across the top, then the form beside the season summary. The
    // page fills the container rather than stopping short of it: the cure for a
    // lot of empty space to the right of a form is more to read, not a narrower
    // column.
    //
    // `space-y-6` because these two grids used to be direct children of
    // `PageShell`, which owns that rhythm. Behind a Suspense boundary they are
    // one child, so the spacing has to be restated here — and in
    // `ProfileSkeleton`, or the shape shifts when the data lands.
    <div className='space-y-6'>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <IdentityCard label='You are'>
          {manager
            ? `${manager.player_name} ${manager.player_surname}`
            : `League entry ${user.leagueEntry}`}
        </IdentityCard>
        <IdentityCard label='Your team'>
          {manager?.team_name ?? 'Not in this season yet'}
        </IdentityCard>
        <IdentityCard label='Signed in as'>{user.email}</IdentityCard>
        <IdentityCard
          label='Favourite club'
          aside={
            club && (
              <ClubCrest
                code={club.code}
                name={club.name}
                className='h-10 w-10'
              />
            )
          }
        >
          {club?.name ?? 'Not picked yet'}
        </IdentityCard>
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        <Card className='border-white/10 bg-[#2a0d33] lg:col-span-2'>
          <CardHeader className='flex-row items-center justify-between space-y-0'>
            <CardTitle className='text-white'>Details</CardTitle>
            <AuthPanel signedIn />
          </CardHeader>
          <CardContent>
            <ProfileForm
              displayName={profile?.displayName ?? null}
              bio={profile?.bio ?? null}
              favouriteTeam={favouriteTeam}
              teams={teams}
              onboarding={onboarding}
            />
          </CardContent>
        </Card>

        <Card className='border-white/10 bg-[#2a0d33]'>
          <CardHeader>
            <CardTitle className='text-white'>Your season</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {manager && played ? (
              <>
                <Stat label='F1 score' value={manager.f1_score} />
                <Stat label='F1 ranking' value={`#${manager.f1_ranking}`} />
                <Stat label='Gameweeks played' value={stats.totalGameweeks} />
                <Stat label='Gameweeks won' value={stats.totalWins} />
                <Stat
                  label='Rumblers'
                  value={stats.rumblerCount}
                  // The one stat here nobody wants a high number on, so it is
                  // the one that reads differently at a glance.
                  accent={stats.rumblerCount > 0}
                />
                <Stat
                  label='Best gameweek'
                  value={`${stats.bestGameweek.points} · GW${stats.bestGameweek.gameweek}`}
                />
                <Stat label='Average points' value={stats.averagePoints} />

                <Link
                  href={`/players/${user.leagueEntry}`}
                  className='block pt-1 text-sm text-[#75fa95] hover:underline'
                >
                  See your full season
                </Link>
              </>
            ) : (
              <p className='text-sm text-white/50'>
                Nothing to show until this season has a finished gameweek in it.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * One fact about who you are, read-only.
 *
 * Three of the four are not yours to change — the manager and team come from
 * upstream via `league_members`, the email from the session — which is why they
 * sit beside the form rather than in it. The fourth mirrors what the form set.
 */
function IdentityCard({
  label,
  children,
  aside,
}: {
  label: string;
  children: React.ReactNode;
  /** Sits to the right, centred against both lines. The crest uses it. */
  aside?: React.ReactNode;
}) {
  return (
    <Card className='border-white/10 bg-[#2a0d33]'>
      <CardContent className='flex items-center justify-between gap-3 pt-4 md:pt-6'>
        <div className='min-w-0'>
          <p className='text-xs text-white/40'>{label}</p>
          <p className='truncate text-base font-bold text-white'>{children}</p>
        </div>
        {aside}
      </CardContent>
    </Card>
  );
}

/** A labelled number in the season summary. */
function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className='flex items-baseline justify-between gap-3'>
      <span className='text-sm text-white/50'>{label}</span>
      <span
        className={cn(
          'text-lg font-bold',
          accent ? 'text-[#ff8fa3]' : 'text-white',
        )}
      >
        {value}
      </span>
    </div>
  );
}
