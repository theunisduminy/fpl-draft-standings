import Footer from '@/components/Layout/Footer';
import HeaderNav from '@/components/Layout/HeaderNav';
import MobileNav from '@/components/Layout/MobileNav';
import { SideNav } from '@/components/Layout/SideNav';

/**
 * The signed-in shell: navigation, the shared page container, footer.
 *
 * It is a component rather than layout markup because two places need it —
 * `src/app/(app)/layout.tsx` for every real page, and `not-found.tsx`, which
 * has to stay at the app root (Next only honours a root `not-found.tsx` for
 * unmatched URLs) and would otherwise render with no navigation at all.
 *
 * **This is the only place the `max-w-7xl` container is defined.** `HeaderNav`
 * and `Footer` match it internally so the brand lines up with the page heading;
 * a page must never set its own width. See `PageShell`.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Three navigation surfaces, each owning one breakpoint band:
          HeaderNav is the brand bar below `lg`, MobileNav the bottom bar
          below `md`, and SideNav the floating panel from `lg` up. */}
      <HeaderNav />
      <SideNav />

      <main className='flex-1 pt-4 pb-20 md:pt-8 md:pb-8 lg:pt-4 lg:pl-64'>
        <div className='mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'>
          {children}
        </div>
      </main>

      <Footer />
      <MobileNav />
    </>
  );
}
