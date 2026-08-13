import { cn } from '@/lib/utils';

/**
 * The chrome every page shares: title, subtitle, and the vertical rhythm the
 * content sits in.
 *
 * **Every page goes through this, with no exceptions.** Page width is owned by
 * one place — the `max-w-7xl` container in `src/app/layout.tsx`, which
 * `HeaderNav` and `Footer` match — so a page must never set its own `max-w-*`
 * or `mx-auto`. A page that does drifts out of alignment with the header, which
 * is exactly what `/profile` used to do: `max-w-md` signed out, `max-w-xl`
 * signed in, neither matching anything else on the site.
 *
 * `width='narrow'` is the one sanctioned deviation, for a page that is a single
 * column of form controls rather than a data view. It centres inside the shared
 * container rather than replacing it.
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
  width = 'full',
  children,
}: {
  title: string;
  subtitle?: string;
  /** `narrow` for single-column form pages; `full` for every data view. */
  width?: 'full' | 'narrow';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'w-full space-y-6',
        width === 'narrow' && 'mx-auto max-w-xl',
      )}
    >
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold text-white md:text-3xl'>{title}</h1>
        {subtitle && <p className='text-sm text-white/60'>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
