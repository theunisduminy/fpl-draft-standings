import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * The card every chart on the season tab sits in.
 *
 * Three components were each restating the same six lines — card, header, title
 * at `text-base md:text-lg`, optional caption at `text-xs` — and the copies had
 * already begun to differ: two carried a caption, one did not, and the padding
 * on the body varied by component rather than by need. That is how a row of
 * cards ends up almost aligned.
 *
 * `contentClassName` exists because the variation that *is* real lives there: a
 * chart wants tighter padding than a list does, since recharts draws its own
 * margins inside the plot area and the card's would double them.
 *
 * Deliberately not `'use client'`. It renders nothing interactive, so it stays
 * usable from a server component; the charts that import it are client
 * components for recharts' sake, not because of anything here.
 */
export function ChartCard({
  title,
  caption,
  action,
  contentClassName,
  children,
}: {
  title: string;
  /** One line under the title, saying what the chart is showing. */
  caption?: string;
  /**
   * A control that changes what the chart shows, sat beside the title.
   *
   * Only for something that rewrites the title and caption too — the bump
   * chart's position-or-gap switch is the case this exists for. A control that
   * merely filters belongs above the card with the rest of the page's
   * furniture, not inside the heading of one chart.
   */
  action?: React.ReactNode;
  /** Body padding, where the real per-chart variation lives. */
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className='w-full border-border bg-card'>
      <CardHeader
        className={cn(
          'pb-2',
          action && 'gap-3 sm:flex-row sm:items-start sm:justify-between',
        )}
      >
        <div>
          <CardTitle className='text-base text-foreground md:text-lg'>
            {title}
          </CardTitle>
          {caption && (
            <p className='text-xs text-muted-foreground'>{caption}</p>
          )}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  );
}
