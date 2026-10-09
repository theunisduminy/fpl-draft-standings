import { describe, expect, it } from 'vitest';

import {
  classifySessionCheck,
  findSetCookieValue,
  readRequestCookie,
  renewedSessionTokenCookie,
  RETURNING_MEMBER_COOKIE_HEADER,
  SESSION_DATA_COOKIE,
  SESSION_TOKEN_COOKIE,
  sessionExpiryFromSessionData,
  shouldAutoSignIn,
} from './session-renewal';

function jwtWith(payload: unknown): string {
  const part = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part(payload)}.signature`;
}

describe('readRequestCookie', () => {
  it('returns the raw value, percent-encoding intact', () => {
    const header = `other=1; ${SESSION_TOKEN_COOKIE}=abc.def%2Bg%3D; x=2`;
    expect(readRequestCookie(header, SESSION_TOKEN_COOKIE)).toBe(
      'abc.def%2Bg%3D',
    );
  });

  it('does not match a cookie whose name merely contains the one asked for', () => {
    const header = `${SESSION_DATA_COOKIE}=jwt`;
    expect(readRequestCookie(header, SESSION_TOKEN_COOKIE)).toBeNull();
  });

  it('treats an empty value as absent', () => {
    expect(
      readRequestCookie(`${SESSION_TOKEN_COOKIE}=`, SESSION_TOKEN_COOKIE),
    ).toBeNull();
  });
});

describe('findSetCookieValue', () => {
  it('finds the minted session_data cookie', () => {
    const headers = [
      `${SESSION_DATA_COOKIE}=a.b.c; Path=/; Max-Age=300; HttpOnly`,
    ];
    expect(findSetCookieValue(headers, SESSION_DATA_COOKIE)).toBe('a.b.c');
  });

  it('treats a deletion as absent, so a sign-out never renews the token', () => {
    const headers = [`${SESSION_DATA_COOKIE}=; Path=/; Max-Age=0`];
    expect(findSetCookieValue(headers, SESSION_DATA_COOKIE)).toBeNull();
  });
});

describe('sessionExpiryFromSessionData', () => {
  it("reads Neon's session expiry from the payload", () => {
    const jwt = jwtWith({ session: { expiresAt: '2026-10-16T08:00:00.000Z' } });
    expect(sessionExpiryFromSessionData(jwt)?.toISOString()).toBe(
      '2026-10-16T08:00:00.000Z',
    );
  });

  it('returns null for anything it cannot read, rather than throwing', () => {
    expect(sessionExpiryFromSessionData('not-a-jwt')).toBeNull();
    expect(sessionExpiryFromSessionData('a.%%%.c')).toBeNull();
    expect(sessionExpiryFromSessionData(jwtWith({ session: null }))).toBeNull();
    expect(
      sessionExpiryFromSessionData(jwtWith({ session: { expiresAt: 'soon' } })),
    ).toBeNull();
  });
});

describe('classifySessionCheck', () => {
  it('a session in a 200 is valid, with its expiry', () => {
    const check = classifySessionCheck(200, {
      session: { expiresAt: '2026-10-16T08:00:00.000Z' },
    });
    expect(check).toEqual({
      kind: 'valid',
      expiresAt: new Date('2026-10-16T08:00:00.000Z'),
    });
  });

  it('a 200 with no session is Neon saying signed out', () => {
    expect(classifySessionCheck(200, null)).toEqual({ kind: 'signed-out' });
    expect(classifySessionCheck(200, { session: null })).toEqual({
      kind: 'signed-out',
    });
  });

  it('a 401 is signed out', () => {
    expect(classifySessionCheck(401, null)).toEqual({ kind: 'signed-out' });
  });

  it('a Neon failure is never read as signed out', () => {
    for (const status of [500, 502, 503, 504, 429, 404]) {
      expect(classifySessionCheck(status, null)).toEqual({ kind: 'unknown' });
    }
  });
});

describe('renewedSessionTokenCookie', () => {
  const now = new Date('2026-10-09T08:00:00.000Z');

  it('re-issues the token byte for byte, with Max-Age to the session expiry', () => {
    const cookie = renewedSessionTokenCookie(
      'abc.def%2B',
      new Date('2026-10-16T08:00:00.000Z'),
      now,
    );
    expect(cookie).toBe(
      `${SESSION_TOKEN_COOKIE}=abc.def%2B; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`,
    );
  });

  it('issues nothing for a session that is already over', () => {
    expect(renewedSessionTokenCookie('t', now, now)).toBeNull();
    expect(
      renewedSessionTokenCookie('t', new Date(now.getTime() - 1000), now),
    ).toBeNull();
  });
});

describe('shouldAutoSignIn', () => {
  it('signs a returning browser straight back in', () => {
    expect(
      shouldAutoSignIn({ hasReturningFlag: true, hasAuthError: false }),
    ).toBe(true);
  });

  it('waits for a click from a browser that has never signed in', () => {
    expect(
      shouldAutoSignIn({ hasReturningFlag: false, hasAuthError: false }),
    ).toBe(false);
  });

  it('never retries straight after a failed attempt, which would loop', () => {
    expect(
      shouldAutoSignIn({ hasReturningFlag: true, hasAuthError: true }),
    ).toBe(false);
  });
});

describe('RETURNING_MEMBER_COOKIE_HEADER', () => {
  it('is readable by script, so sign-out can clear it in the browser', () => {
    expect(RETURNING_MEMBER_COOKIE_HEADER).not.toMatch(/HttpOnly/i);
    expect(RETURNING_MEMBER_COOKIE_HEADER).toMatch(/^bd-returning=1;/);
  });
});
