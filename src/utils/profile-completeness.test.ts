import { describe, expect, it } from 'vitest';

import { isProfileComplete } from './profile-completeness';

const complete = {
  displayName: 'Mossi',
  bio: 'Perpetually one gameweek from greatness.',
  favouriteTeam: 6,
};

describe('isProfileComplete', () => {
  it('accepts a profile with all three fields', () => {
    expect(isProfileComplete(complete)).toBe(true);
  });

  it('rejects a missing profile', () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  it.each([
    ['display name', { displayName: null }],
    ['bio', { bio: null }],
    ['favourite club', { favouriteTeam: null }],
  ])('rejects a profile with no %s', (_field, missing) => {
    expect(isProfileComplete({ ...complete, ...missing })).toBe(false);
  });

  it.each([
    ['display name', { displayName: '   ' }],
    ['bio', { bio: '\n\t ' }],
  ])('does not accept whitespace as a %s', (_field, blank) => {
    expect(isProfileComplete({ ...complete, ...blank })).toBe(false);
  });

  it('treats an empty string club as absent', () => {
    // `favouriteTeam` arrives as a number, but the gate reads a database column
    // that a bad write could leave at 0 — which is not a real team code.
    expect(isProfileComplete({ ...complete, favouriteTeam: 0 })).toBe(false);
  });
});
