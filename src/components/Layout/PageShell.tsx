/**
 * The chrome every data page shares: title, subtitle, and the vertical rhythm
 * the content sits in.
 *
 * It exists so the heading is painted **above** the Suspense boundary. The
 * title and subtitle are static strings, known before any read, so making the
 * reader wait on the FPL API to see them is pure loss — and a skeleton that
 * redraws the heading has to guess its dimensions, which is where layout shift
 * comes from.
 *
 * Each route's `loading.tsx` therefore renders only the region below this, and
 * never the heading.
 */
export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className='w-full space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold text-white md:text-3xl'>{title}</h1>
        <p className='text-sm text-white/60'>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
