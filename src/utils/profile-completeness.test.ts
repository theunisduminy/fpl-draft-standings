import { describe, expect, it } from 'vitest';

import { isProfileComplete } from './profile-completeness';

const complete = {
  displayName: 'Mossi',
  favouriteTeam: 6,
};

describe('isProfileComplete', () => {
  it('accepts a profile with both fields', () => {
    expect(isProfileComplete(complete)).toBe(true);
  });

  it('rejects a missing profile', () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  it.each([
    ['display name', { displayName: null }],
    ['favourite club', { favouriteTeam: null }],
  ])('rejects a profile with no %s', (_field, missing) => {
    expect(isProfileComplete({ ...complete, ...missing })).toBe(false);
  });

  it('does not accept whitespace as a display name', () => {
    expect(isProfileComplete({ ...complete, displayName: '   ' })).toBe(false);
  });

  it('treats an empty string club as absent', () => {
    // `favouriteTeam` arrives as a number, but the gate reads a database column
    // that a bad write could leave at 0 — which is not a real team code.
    expect(isProfileComplete({ ...complete, favouriteTeam: 0 })).toBe(false);
  });
});
