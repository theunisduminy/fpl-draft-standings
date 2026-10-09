import { readdirSync } from 'node:fs';
import { dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The route loading rules from AGENTS.md, pinned against the file tree.
 *
 * Layout is verified by eye, but which `loading.tsx` wraps which page is a fact
 * about files, and both ways of getting it wrong fail silently: a loader above a
 * route that can 404 turns the 404 into a 200, and a loader above another page
 * shows two skeletons on one click.
 */
const appDir = dirname(fileURLToPath(import.meta.url));

function routeFiles(name: string): string[] {
  return readdirSync(appDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.split(sep).at(-1) === name)
    .map((file) => file.split(sep).join('/'))
    .sort();
}

const loaders = routeFiles('loading.tsx');
const pages = routeFiles('page.tsx');

/** The folder a route file sits in, with a trailing slash. */
function folderOf(file: string): string {
  return file.slice(0, file.lastIndexOf('/') + 1);
}

describe('route loading contract', () => {
  it('finds the routes', () => {
    expect(pages.length).toBeGreaterThan(5);
    expect(loaders.length).toBeGreaterThan(0);
  });

  // A loader wraps every page below its folder, so a page with routes beneath it
  // sits in a route group, `(home)`, to keep its skeleton to itself.
  it('lets a loader wrap only its own page', () => {
    for (const loader of loaders) {
      const folder = folderOf(loader);
      const wrapped = pages.filter((page) => page.startsWith(folder));
      expect(wrapped, loader).toEqual([`${folder}page.tsx`]);
    }
  });

  // A dynamic segment is the only kind of route here that can 404, and a loader
  // above one commits a 200 before the page decides. See AGENTS.md.
  it('puts no loader above or beside a page that can 404', () => {
    for (const page of pages.filter((page) => page.includes('['))) {
      for (const loader of loaders) {
        expect(
          page.startsWith(folderOf(loader)),
          `${loader} wraps ${page}`,
        ).toBe(false);
      }
    }
  });

  it('gives every other page its own loader, except /profile', () => {
    for (const page of pages) {
      if (page.includes('[')) continue;
      // Its title depends on whether the profile is finished, so a route shell
      // cannot know it. See AGENTS.md.
      if (page.endsWith('profile/page.tsx')) continue;
      expect(loaders, page).toContain(`${folderOf(page)}loading.tsx`);
    }
  });
});
