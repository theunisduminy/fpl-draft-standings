/**
 * The chrome every page shares: title, subtitle, and the vertical rhythm the
 * content sits in.
 *
 * **Every page inside the `(app)` group goes through this.** Page width is
 * owned by one place — the `max-w-7xl` container in `AppChrome`, which
 * `HeaderNav` and `Footer` match — so a page must never centre itself with
 * `mx-auto`, and must never widen past the container. A page that does drifts
 * out of alignment with the header, which is exactly what `/profile` used to
 * do: `max-w-md` signed out, `max-w-xl` signed in, both centred, neither
 * matching anything else on the site.
 *
 * Capping the *content* narrower than the container is fine, and `/profile`
 * does it: a `max-w-4xl` column with no `mx-auto`. The left edge — the one the
 * heading sets and the eye follows down the page — does not move. Only the
 * right edge comes in, which is what stops a form reading like a spreadsheet.
 *
 * `/auth/sign-in` is the one page outside that rule, because it is outside the
 * chrome: it renders against the root layout with no header to line up with and
 * no navigation at all. It owns its own centring, and it is the only page
 * allowed to.
 *
 * There is deliberately no width prop. `/profile` briefly had a narrow variant
 * for being a form rather than a data view, and the result was a page whose
 * heading started somewhere different from every other heading on the site. One
 * width, one left edge.
 *
 * The heading is painted **above** the Suspense boundary on data pages. The
 * title and subtitle are static strings, known before any read, so making the
 * reader wait on the FPL API to see them is pure loss — and a skeleton that
 * redraws the heading has to guess its dimensions, which is where layout shift
 * comes from. Each route's `loading.tsx` therefore renders only the region
 * below this, never the heading.
 */
export function PageShell({
  title,
  subtitle,
  back,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  /**
   * A back link, rendered to the left of the title.
   *
   * Detail pages need one; list pages do not. It is a prop rather than
   * something the page draws itself, because a page that builds its own header
   * stops sharing the heading height and left edge with every other page —
   * which is what `/players/[playerId]` used to do.
   */
  back?: React.ReactNode;
  /** Trailing content on the heading row, e.g. a status badge. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // The top padding lives here, not on `<main>`: it is the gap above the
    // *title*, so it belongs with the title. Every page and every `loading.tsx`
    // renders through this, so the heading sits at one height across the site
    // and the skeleton shells line up with the real thing.
    <div className='w-full space-y-6 pt-3 md:pt-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-3'>
          {back}
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold text-white md:text-3xl'>
              {title}
            </h1>
            {subtitle && <p className='text-sm text-white/60'>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
