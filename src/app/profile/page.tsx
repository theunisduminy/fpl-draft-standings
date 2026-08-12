import type { Metadata } from 'next';

import { getCurrentUser } from '@/server/auth/server';
import { getProfileByUserId, listProfiles } from '@/server/data/profiles';
import { getGameweekData } from '@/utils/gameweek-data';
import { AuthPanel } from '@/components/Profile/AuthPanel';
import {
  ClaimEntryForm,
  type ClaimableManager,
} from '@/components/Profile/ClaimEntryForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
      <Card className='mx-auto mt-8 max-w-md border-white/10 bg-[#2a0d33]'>
        <CardHeader>
          <CardTitle className='text-white'>Sign in</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-sm text-white/60'>
            Profiles are for the eight managers in this league. Sign in with the
            Google account whose address is on the league list.
          </p>
          <AuthPanel signedIn={false} />
        </CardContent>
      </Card>
    );
  }

  const [{ players }, profile, allProfiles] = await Promise.all([
    getGameweekData(),
    getProfileByUserId(user.id),
    listProfiles(),
  ]);

  const claimedByOthers = new Set(
    allProfiles
      .filter((row) => row.userId !== user.id)
      .map((row) => row.leagueEntry),
  );

  const managers: ClaimableManager[] = players.map((player) => ({
    id: player.id,
    label: `${player.player_name} ${player.player_surname} — ${player.team_name}`,
    claimedByOther: claimedByOthers.has(player.id),
  }));

  return (
    <div className='mx-auto mt-8 max-w-xl space-y-6'>
      <Card className='border-white/10 bg-[#2a0d33]'>
        <CardHeader className='flex-row items-center justify-between space-y-0'>
          <CardTitle className='text-white'>Your profile</CardTitle>
          <AuthPanel signedIn />
        </CardHeader>
        <CardContent className='space-y-6'>
          <p className='text-sm text-white/50'>Signed in as {user.email}</p>
          <ClaimEntryForm
            managers={managers}
            currentEntry={profile?.leagueEntry ?? null}
            currentDisplayName={profile?.displayName ?? null}
            currentBio={profile?.bio ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
