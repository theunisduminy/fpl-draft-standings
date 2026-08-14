import type { ElementCode, TeamCode } from '@/interfaces/fpl';

/**
 * Images on the Premier League's own asset host.
 *
 * The one place those URLs are written, and deliberately not `fpl-api.ts`: that
 * module is `server-only`, and these are images a browser loads, so a client
 * component has to be able to reach the builders. Nothing here fetches — each
 * returns a string for an `src` attribute.
 *
 * **Both take a `code`, never an `id`.** Codes are stable across seasons; the
 * sibling `id` fields are re-minted every August, so a URL built from one would
 * quietly start returning a different club or a different footballer. Worse,
 * the host answers a bad code with a `403`, not a 404 or a placeholder — a
 * broken image in the page and nothing at all in a log.
 */

/** A club crest, as SVG. All 20 current clubs resolve. */
export function clubCrestUrl(code: TeamCode): string {
  return `https://resources.premierleague.com/premierleague/badges/t${code}.svg`;
}

/**
 * A player's headshot.
 *
 * `40x40` is the smallest of the three sizes the host offers and the only one
 * sane in a list: the same photo at `110x140` is 108 KB, which is 1.6 MB for a
 * squad of fifteen. `250x250` exists for a detail page that wants one face.
 *
 * Not every element has a photo — new signings lag by days — so anything
 * rendering this needs a fallback for the 403.
 */
export function playerPhotoUrl(
  code: ElementCode,
  size: '40x40' | '110x140' | '250x250' = '40x40',
): string {
  return `https://resources.premierleague.com/premierleague/photos/players/${size}/p${code}.png`;
}
