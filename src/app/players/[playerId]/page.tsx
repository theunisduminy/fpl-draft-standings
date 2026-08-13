import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, User } from 'lucide-react';

import { parseLeagueEntryId } from '@/interfaces/fpl';
import { getGameweekData } from '@/utils/gameweek-data';
import { buildPlayerProfile } from '@/utils/player-profile';
import { PlayerSummaryCard } from '@/components/PlayerView/PlayerSummaryCard';
import { PlayerPerformanceChart } from '@/components/PlayerView/PlayerPerformanceChart';
import { PositionStatsCard } from '@/components/PlayerView/PositionStatsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ playerId: string }> };

/**
 * Resolve the route param to a manager, or 404.
 *
 * The param is untrusted, so it goes through `parseLeagueEntryId` rather than
 * `parseInt` — which would happily read "39837-nonsense" as 39837.
 */
async function loadProfile(params: PageProps['params']) {
  const { playerId } = await params;
  const leagueEntry = parseLeagueEntryId(playerId);

  if (!leagueEntry) notFound();

  const profile = buildPlayerProfile(await getGameweekData(), leagueEntry);

  if (!profile) notFound();

  return profile;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { playerId } = await params;
  const leagueEntry = parseLeagueEntryId(playerId);

  if (!leagueEntry) return { title: 'Player' };

  const profile = buildPlayerProfile(await getGameweekData(), leagueEntry);

  return { title: profile ? profile.player_name : 'Player' };
}

export default async function PlayerStatistics({ params }: PageProps) {
  const profile = await loadProfile(params);

  return (
    <div className='w-full space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-3'>
          <Link href='/'>
            <Button
              variant='ghost'
              size='icon'
              className='text-white hover:bg-white/10'
            >
              <ChevronLeft className='h-5 w-5' />
            </Button>
          </Link>
          <div>
            <h1 className='text-xl font-bold text-white md:text-2xl'>
              {profile.player_name}
            </h1>
            <p className='text-sm text-white/50'>Season performance</p>
          </div>
        </div>
        <Badge
          variant='outline'
          className='w-fit border-[#00edfd]/30 bg-[#00edfd]/10 text-[#00edfd]'
        >
          <User className='mr-1 h-3 w-3' />
          {profile.team_name}
        </Badge>
      </div>

      <PlayerPerformanceChart
        data={profile.performance}
        playerName={profile.player_name}
      />

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <PlayerSummaryCard player={profile} />
        <PositionStatsCard stats={profile.stats} />
      </div>
    </div>
  );
}
