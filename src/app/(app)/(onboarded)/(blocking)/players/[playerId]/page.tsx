import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, User } from 'lucide-react';

import { parseLeagueEntryId } from '@/interfaces/fpl';
import { getGameweekData } from '@/utils/gameweek-data';
import { buildPlayerProfile } from '@/utils/player-profile';
import type { PlayerProfile } from '@/interfaces/players';
import { PageShell } from '@/components/Layout/PageShell';
import { PlayerSummaryCard } from '@/components/PlayerView/PlayerSummaryCard';
import { PlayerPerformanceChart } from '@/components/PlayerView/PlayerPerformanceChart';
import { PositionStatsCard } from '@/components/PlayerView/PositionStatsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Reads live upstream data, so it is never prerendered.
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ playerId: string }> };

type ResolvedProfile = {
  profile: PlayerProfile;
  /**
   * Straight from `getGameweekData()`, which takes it from
   * `deriveSeasonState()`. Not narrowed to "does this manager have a row for
   * it": their F1 ranking moves with everyone else's provisional score too.
   */
  provisionalGameweek: number | null;
};

/**
 * Resolve the route param to a manager and the gameweek in flight, or `null`.
 *
 * The param is untrusted, so it goes through `parseLeagueEntryId` rather than
 * `parseInt` — which would happily read "39837-nonsense" as 39837.
 *
 * `cache` because Next calls `generateMetadata` and the page in the same
 * request: without it the whole profile is derived twice, and the two copies
 * can disagree about whether the manager exists.
 */
const resolveProfile = cache(
  async (playerId: string): Promise<ResolvedProfile | null> => {
    const leagueEntry = parseLeagueEntryId(playerId);

    if (!leagueEntry) return null;

    const data = await getGameweekData();
    const profile = buildPlayerProfile(data, leagueEntry);

    return profile
      ? { profile, provisionalGameweek: data.provisionalGameweek }
      : null;
  },
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { playerId } = await params;
  const resolved = await resolveProfile(playerId);

  return { title: resolved?.profile.player_name ?? 'Player' };
}

export default async function PlayerStatistics({ params }: PageProps) {
  const { playerId } = await params;
  const resolved = await resolveProfile(playerId);

  if (!resolved) notFound();

  const { profile, provisionalGameweek } = resolved;

  return (
    <PageShell
      title={profile.player_name}
      subtitle='Season performance'
      back={
        <Link href='/'>
          <Button
            variant='ghost'
            size='icon'
            className='text-white hover:bg-white/10'
          >
            <ChevronLeft className='h-5 w-5' />
            <span className='sr-only'>Back to standings</span>
          </Button>
        </Link>
      }
      action={
        <Badge
          variant='outline'
          className='w-fit border-[#00edfd]/30 bg-[#00edfd]/10 text-[#00edfd]'
        >
          <User className='mr-1 h-3 w-3' />
          {profile.team_name}
        </Badge>
      }
    >
      <PlayerPerformanceChart
        data={profile.performance}
        playerName={profile.player_name}
        provisionalGameweek={provisionalGameweek}
      />

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <PlayerSummaryCard
          player={profile}
          provisionalGameweek={provisionalGameweek}
        />
        <PositionStatsCard
          stats={profile.stats}
          provisionalGameweek={provisionalGameweek}
        />
      </div>
    </PageShell>
  );
}
