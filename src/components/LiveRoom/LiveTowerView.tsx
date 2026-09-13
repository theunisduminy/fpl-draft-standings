import { getLiveGameweek } from '@/utils/live-gameweek';
import { EmptyState } from '@/components/EmptyState';
import { LiveTower } from './LiveTower';

/**
 * The live tower as a standings tab panel.
 *
 * Reads the live slice and maps it onto the presentation rows, or renders
 * the honest empty state for every non-live condition: pre-kickoff, idle,
 * and unreadable all explain themselves rather than throwing or ranking
 * zeros. The tab itself carries the "live" meaning, so there is no badge
 * here — the tower's own provisional labelling stands as is.
 */
export async function LiveTowerView() {
  const result = await getLiveGameweek();

  // Pre-kickoff: fixtures exist but nobody has played, so there is nothing to
  // rank. Zeros are never ranked; the starts soon state says so instead.
  if (result?.state === 'pre-kickoff') {
    return (
      <EmptyState>
        <p className='font-medium text-foreground'>
          GW{result.gameweek} starts soon
        </p>
        <p className='mt-1'>
          The fixtures are set but nobody has played yet. Provisional positions
          appear here after kickoff.
        </p>
      </EmptyState>
    );
  }

  // Field mapping against the frozen slice: the live member carries
  // `gameweek`, `computedAt` epoch millis, and `rows` in provisional order
  // where each row carries `rank` and `event_total` from the derivation. Those
  // map to the presentation `position` and `points` below, so a slice that
  // spells a field differently fails here at merge rather than rendering
  // undefined. Nothing here invents a number.
  if (result?.state === 'live') {
    return (
      <LiveTower
        data={{
          gameweek: result.gameweek,
          computedAt: result.computedAt,
          rows: result.rows.map((row) => ({
            position: row.rank,
            managerName: row.managerName,
            teamName: row.teamName,
            points: row.event_total,
            interval: row.interval,
            cushion: row.cushion,
            done: row.done,
            toPlay: row.toPlay,
            movement: row.movement,
          })),
        }}
      />
    );
  }

  // Idle: no gameweek in flight, so no ranks at all.
  if (result?.state === 'idle') {
    return (
      <EmptyState>
        <p className='font-medium text-foreground'>No gameweek in progress</p>
        <p className='mt-1'>
          The live room opens while a gameweek is being played. Finished
          gameweeks are on standings and results.
        </p>
      </EmptyState>
    );
  }

  // Unavailable, and anything unrecognised: the feed or the picks could not be
  // read. This renders the explanatory state rather than throwing, and never a
  // board of zeros.
  return (
    <EmptyState>
      <p className='font-medium text-foreground'>Live feed unavailable</p>
      <p className='mt-1'>
        The live feed could not be read, so there is nothing provisional to
        show. Please try again later.
      </p>
    </EmptyState>
  );
}
