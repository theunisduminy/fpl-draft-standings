import { describe, expect, it, vi } from 'vitest';

import { asEntryId } from '@/interfaces/fpl';

// `fpl-api.ts` is `server-only`, which throws on import outside a Server
// Component. The builders under test are pure — no fetch runs here — so the
// boundary is stubbed the way `cache.test.ts` stubs `next/cache`.
vi.mock('server-only', () => ({}));

const { fplApi, pulseApi } = await import('./fpl-api');

/**
 * The gateway unification, pinned. Every builder returns a request descriptor
 * rather than a bare URL, so endpoint requirements travel with the endpoint:
 * Pulse's `Origin` header cannot be forgotten at a call site, because no call
 * site attaches headers at all. A Pulse read without it 403s and reads as
 * "the Premier League page is down", so this is the shape that stops that
 * class of outage structurally rather than by convention.
 */
describe('upstream endpoint builders', () => {
  it('attaches the Premier League Origin header to every Pulse request', () => {
    const seasonId = 841;

    const requests = [
      pulseApi.compSeasons(),
      pulseApi.standings(seasonId),
      pulseApi.fixtures(seasonId),
    ];

    for (const req of requests) {
      expect(req.headers?.Origin).toBe('https://www.premierleague.com');
    }
  });

  it('attaches no headers to FPL requests', () => {
    const leagueId = 8337;

    const requests = [
      fplApi.eventStatus(),
      fplApi.game(),
      fplApi.leagueDetails(leagueId),
      fplApi.eventLive(1),
      fplApi.elementStatus(leagueId),
      fplApi.draftChoices(leagueId),
      fplApi.draftBootstrap(),
      fplApi.entryEvent(asEntryId(39781), 1),
      fplApi.bootstrapStatic(),
      fplApi.fixtures(),
    ];

    for (const req of requests) {
      expect(req.headers).toBeUndefined();
    }
  });

  it('names every endpoint for the failure logs', () => {
    const requests = [
      fplApi.eventStatus(),
      fplApi.game(),
      fplApi.leagueDetails(8337),
      fplApi.eventLive(1),
      fplApi.elementStatus(8337),
      fplApi.draftChoices(8337),
      fplApi.draftBootstrap(),
      fplApi.entryEvent(asEntryId(39781), 1),
      fplApi.bootstrapStatic(),
      fplApi.fixtures(),
      pulseApi.compSeasons(),
      pulseApi.standings(841),
      pulseApi.fixtures(841),
    ];

    for (const req of requests) {
      expect(req.url.length).toBeGreaterThan(0);
      expect(req.label.length).toBeGreaterThan(0);
    }
  });
});
