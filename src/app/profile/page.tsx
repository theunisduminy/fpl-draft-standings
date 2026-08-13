import type { Metadata } from 'next';

import { getCurrentUser } from '@/server/auth/server';
import { getProfileByUserId } from '@/server/data/profiles';
import { getGameweekData } from '@/utils/gameweek-data';
import { AuthPanel } from '@/components/Profile/AuthPanel';
import { ProfileForm } from '@/components/Profile/ProfileForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageShell } from '@/components/Layout/PageShell';

export const metadata: Metadata = { title: 'Profile' };

// Reads the session, so it can never be prerendered.
export const dynamic = 'force-dynamic';

/**
 * The first Server Component in the app — it reads its own data rather than
 * going through `/api/*` and a client fetch. New pages should follow this
 * shape; see agents/ARCHITECTURE.md.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <PageShell
        title='Sign in'
        subtitle='Profiles are for the managers in this league'
        width='narrow'
      >
        <Card className='border-white/10 bg-[#2a0d33]'>
          <CardContent className='space-y-4 pt-6'>
            <p className='text-sm text-white/60'>
              Sign in with the Google account that is on the league list.
            </p>
            <AuthPanel signedIn={false} />
            <p className='text-xs text-white/40'>
              Signed in and still seeing this? Your address is not mapped to a
              manager yet — ask the league admin to add you.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const [{ players }, profile] = await Promise.all([
    getGameweekData(),
    getProfileByUserId(user.id),
  ]);

  const manager = players.find((player) => player.id === user.leagueEntry);

  return (
    <PageShell title='Your profile' subtitle={user.email} width='narrow'>
      <Card className='border-white/10 bg-[#2a0d33]'>
        <CardHeader className='flex-row items-center justify-between space-y-0'>
          <CardTitle className='text-white'>Details</CardTitle>
          <AuthPanel signedIn />
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='rounded-lg bg-[#1a0520] p-3'>
            <p className='text-xs text-white/40'>You are</p>
            <p className='text-base font-bold text-white'>
              {manager
                ? `${manager.player_name} ${manager.player_surname}`
                : `League entry ${user.leagueEntry}`}
            </p>
            {manager && (
              <p className='text-sm text-white/50'>{manager.team_name}</p>
            )}
          </div>

          <ProfileForm
            displayName={profile?.displayName ?? null}
            bio={profile?.bio ?? null}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
