import { cn } from '@/lib/utils';

/**
 * Wraps a streamed region's skeleton. Every `<Suspense fallback>` and every
 * route `loading.tsx` body goes through this — it is the one place two
 * cross-cutting concerns are handled, so no call site has to remember them.
 *
 * **Announcement.** The bars themselves are `aria-hidden` (see `Skeleton`), so
 * this wrapper carries the single `role='status'` + `aria-busy` and one
 * visually-hidden "Loading" string, rather than a screen reader meeting a table
 * of empty cells.
 *
 * **Delayed reveal, and why only the route shell gets it.** A soft navigation
 * paints *two* skeletons in sequence: the route's `loading.tsx` first, then —
 * once the Server Component resolves and the page mounts — the page's own
 * `<Suspense fallback>` while its region is still pending. The two are visually
 * identical, so the swap should be invisible.
 *
 * It isn't, if both delay. The second is a brand-new DOM element, so the CSS
 * animation restarts and holds it at `opacity: 0` for another 200ms — a blank
 * gap between two identical skeletons, which reads as a flicker right at the
 * handoff.
 *
 * So the delay belongs to whichever skeleton appears *first*: the route shell.
 * By the time an in-page fallback is reached the window has already elapsed and
 * the region is genuinely slow, so it should appear at once and take over
 * seamlessly.
 *
 * Never nest one inside another; that would announce the same region twice.
 */
export function SkeletonRegion({
  children,
  delayed = false,
  className,
}: {
  children: React.ReactNode;
  /**
   * Hold the skeleton invisible for 200ms before fading it in, so a read that
   * resolves inside that window shows no skeleton at all.
   *
   * Set this **only on a route `loading.tsx`**. An in-page `<Suspense
   * fallback>` must leave it off — see above.
   */
  delayed?: boolean;
  className?: string;
}) {
  return (
    <div
      role='status'
      aria-busy='true'
      className={cn(delayed && 'skeleton-reveal', className)}
    >
      <span className='sr-only'>Loading</span>
      {children}
    </div>
  );
}
