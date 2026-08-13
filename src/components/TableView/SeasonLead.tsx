import { Crown, Target } from 'lucide-react';

import Link from 'next/link';

import { Card } from '@/components/ui/card';
import type { PlayerDetails } from '@/interfaces/players';

/**
 * The one thing worth saying above the standings table: who leads, and whether
 * the table agrees with the points.
 *
 * This league ranks on F1 score — finishing positions, not points — so the
 * manager on top is often not the manager who has scored most. That gap is the
 * whole argument of the season, and it was previously buried in two columns of
 * an eight-row table. When both are the same person the card says so plainly
 * rather than inventing a second statistic to fill the space.
 *
 * A Server Component: it reads nothing and holds no state.
 */
export function SeasonLead({ players }: { players: PlayerDetails[] }) {
  const [leader, runnerUp] = players; // `players` arrives sorted by F1 score.

  if (!leader || leader.f1_score === 0) return null;

  // `points_ranking` is computed once in the scoring layer, so this agrees with
  // the standings table by construction rather than by both getting it right.
  const pointsLeader = players.find((player) => player.points_ranking === 1);
  const sameManager = pointsLeader?.id === leader.id;

  return (
    <Card className='overflow-hidden border-white/10 bg-gradient-to-br from-[#2a0d33] to-[#1a0520]'>
      <div className='grid gap-px bg-white/5 sm:grid-cols-2'>
        <Lead
          icon={<Crown className='h-4 w-4 text-[#00edfd]' />}
          label='Leading the season'
          player={leader}
          value={`${leader.f1_score} F1`}
          note={leadNote(leader, runnerUp)}
        />

        {pointsLeader && (
          <Lead
            icon={<Target className='h-4 w-4 text-[#75fa95]' />}
            label='Most points scored'
            player={pointsLeader}
            value={`${pointsLeader.total_points} pts`}
            note={
              sameManager
                ? 'Leads on both counts'
                : `${leader.player_name} leads on finishes`
            }
          />
        )}
      </div>
    </Card>
  );
}

/** How the lead reads: alone, level, or clear by a margin. */
function leadNote(leader: PlayerDetails, runnerUp?: PlayerDetails): string {
  if (!runnerUp) return 'Alone at the top';

  const gap = leader.f1_score - runnerUp.f1_score;
  return gap > 0
    ? `${gap} clear of ${runnerUp.player_name}`
    : `Level with ${runnerUp.player_name}`;
}

function Lead({
  icon,
  label,
  player,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  player: PlayerDetails;
  value: string;
  note: string;
}) {
  return (
    <div className='bg-[#2a0d33] p-4'>
      <div className='mb-2 flex items-center gap-2'>
        {icon}
        <span className='text-xs text-white/50'>{label}</span>
      </div>
      <Link
        href={`/players/${player.id}`}
        className='block truncate text-lg font-bold text-white transition-colors hover:text-[#00edfd]'
      >
        {player.player_name} {player.player_surname}
      </Link>
      <div className='mt-1 flex items-baseline justify-between gap-2'>
        <span className='text-sm font-semibold text-white/80'>{value}</span>
        <span className='truncate text-xs text-white/40'>{note}</span>
      </div>
    </div>
  );
}
