import { AppChrome } from '@/components/Layout/AppChrome';

/**
 * Everything behind the auth gate renders inside the app chrome.
 *
 * The `(app)` group exists so `/auth/sign-in` can sit outside it. A signed-out
 * visitor has no standings to navigate to and no profile to open, so showing
 * them the header, the bottom nav and the footer would be five links that all
 * bounce straight back to the sign-in page. The root layout keeps `<html>`,
 * `<body>` and the fonts; only the navigation lives here.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppChrome>{children}</AppChrome>;
}
