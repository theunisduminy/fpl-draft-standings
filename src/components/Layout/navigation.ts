import { Trophy, BarChart3, Beer, Users, Shield, User } from 'lucide-react';

/**
 * Every destination, in order: what `SideNav` lists and what `MobileNav`'s menu
 * card lists. One list, so the two cannot drift. (Live is a standings tab while
 * a gameweek is in flight, not a destination.)
 *
 * `HeaderNav`'s strip keeps its own five: it shows only at `md`, where Profile
 * is its avatar button instead.
 */
export const NAVIGATION = [
  { name: 'Standings', href: '/', icon: Trophy },
  { name: 'Results', href: '/results', icon: BarChart3 },
  { name: 'Rumblers', href: '/rumblers', icon: Beer },
  { name: 'Squads', href: '/squads', icon: Users },
  { name: 'Premier League', href: '/premier-league', icon: Shield },
  { name: 'Profile', href: '/profile', icon: User },
] as const;

/**
 * Spread onto the app's own navigation links (`SideNav`, `HeaderNav`'s strip,
 * `MobileNav`'s menu). Next's default prefetch of a page with a `loading.tsx`
 * stops at that boundary, so a click still waits on the server behind the
 * skeleton. `prefetch` renders the whole page ahead of the click, data included,
 * and the click paints from the router cache. Veldboek measured the same change
 * on the same stack: ~340 ms behind a skeleton to ~35 ms with none.
 *
 * The prefetched page is kept for `staleTimes.static` (5 minutes), the same as
 * `getGameweekData`'s own cache, so a prefetched page is no staler than a
 * freshly rendered one would be.
 *
 * Each link costs one server render per full page load, so this is for the
 * navigation only, never ordinary in-page links.
 */
export const FULL_PREFETCH = { prefetch: true } as const;
