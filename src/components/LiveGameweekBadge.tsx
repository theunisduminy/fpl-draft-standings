import { cn } from '@/lib/utils';

/**
 * "GW1 in progress" — the label on any number drawn from an unfinished gameweek.
 *
 * The season now includes the weekend being played, which is the whole point:
 * a league table that ignores Sunday afternoon is wrong on the one day everyone
 * looks at it. But a provisional F1 score rendered identically to a settled one
 * is worse than not showing it at all, because it invites an argument that the
 * data cannot settle. So every surface that shows one carries this.
 *
 * A plain server component with no client state. The dot pulses through CSS
 * alone; `motion-safe:` keeps it still for anyone who has asked for that, and
 * the badge still reads correctly with no animation at all.
 */
export function LiveGameweekBadge({
  gameweek,
  className,
}: {
  gameweek: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-positive/40 bg-positive/10 px-3 py-1 text-xs font-semibold text-positive',
        className,
      )}
    >
      <span className='relative flex h-2 w-2'>
        <span className='absolute inline-flex h-full w-full rounded-full bg-positive opacity-60 motion-safe:animate-ping' />
        <span className='relative inline-flex h-2 w-2 rounded-full bg-positive' />
      </span>
      GW{gameweek} in progress
    </span>
  );
}

/**
 * The same fact as a sentence, for a card that already has a heading.
 *
 * Sentence case, no em dash — see the UI display rules in AGENTS.md.
 */
export function LiveGameweekNote({ gameweek }: { gameweek: number }) {
  return (
    <p className='text-xs text-muted-foreground'>
      GW{gameweek} is still being played. These positions are provisional and
      will change.
    </p>
  );
}
