import Link from 'next/link';
import { Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Acquisition, Squad, SquadPlayer } from '@/utils/squads';

/** The colour a position gets, everywhere it appears. */
const POSITION_CLASSES: Record<string, string> = {
  GKP: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  DEF: 'border-[#00edfd]/30 bg-[#00edfd]/10 text-[#00edfd]',
  MID: 'border-[#75fa95]/30 bg-[#75fa95]/10 text-[#75fa95]',
  FWD: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
};

export function SquadCard({ squad }: { squad: Squad }) {
  return (
    <Card className='border-white/10 bg-[#2a0d33]'>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle className='truncate text-base text-white md:text-lg'>
              {squad.teamName}
            </CardTitle>
            <Link
              href={`/players/${squad.leagueEntry}`}
              className='text-sm text-white/50 transition-colors hover:text-[#00edfd]'
            >
              {squad.managerName}
            </Link>
          </div>
          {squad.autoPickCount > 0 && (
            <Badge
              variant='outline'
              className='shrink-0 border-white/10 bg-[#1a0520] text-xs text-white/50'
              title='Picks made by the clock when time ran out'
            >
              <Zap className='mr-1 h-3 w-3' />
              {squad.autoPickCount} auto
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className='pt-0'>
        {squad.players.length === 0 ? (
          <p className='py-4 text-center text-sm text-white/40'>
            No squad yet.
          </p>
        ) : (
          <ul className='divide-y divide-white/5'>
            {squad.players.map((player) => (
              <PlayerRow key={player.element} player={player} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PlayerRow({ player }: { player: SquadPlayer }) {
  return (
    <li className='flex items-center gap-3 py-2'>
      <Badge
        variant='outline'
        className={`w-11 shrink-0 justify-center border px-0 text-[10px] font-bold ${
          POSITION_CLASSES[player.position] ??
          'border-white/20 bg-white/5 text-white/60'
        }`}
      >
        {player.position}
      </Badge>

      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium text-white'>{player.name}</p>
        <p className='text-xs text-white/40'>{player.club}</p>
      </div>

      <AcquisitionLabel acquisition={player.acquisition} />
    </li>
  );
}

/**
 * Where the player came from.
 *
 * Deliberately quiet — it is a footnote on the row, not the point of it, and
 * for most players it just reads as the round they went in.
 */
function AcquisitionLabel({ acquisition }: { acquisition: Acquisition }) {
  if (acquisition.kind === 'free-agent') {
    return (
      <span className='shrink-0 text-xs text-white/30' title='Not drafted'>
        Free agent
      </span>
    );
  }

  if (acquisition.kind === 'acquired') {
    return (
      <span
        className='shrink-0 text-xs text-amber-400/70'
        title={`Drafted by someone else in round ${acquisition.draftedRound}`}
      >
        Traded
      </span>
    );
  }

  return (
    <span
      className='shrink-0 text-xs text-white/30 tabular-nums'
      title={`Round ${acquisition.round}, pick ${acquisition.pick}${
        acquisition.wasAuto ? ' (auto)' : ''
      }`}
    >
      R{acquisition.round}
      {acquisition.wasAuto && <span className='text-white/50'> ⚡</span>}
    </span>
  );
}
