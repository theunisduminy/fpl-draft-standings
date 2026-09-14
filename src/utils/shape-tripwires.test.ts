import { describe, expect, it } from 'vitest';

import {
  probeEventStatusRows,
  probeEventStatusShape,
  probeLiveElementsPlayed,
  probeLiveElementsPresent,
  probePulseSeasonSelectable,
  probePulseSeasonStarted,
  probeStandingsIdentity,
  runDraftProbes,
  runPulseProbes,
  TRIPWIRE_EVIDENCE_MAX_CHARS,
  type DraftProbeInputs,
  type TripwireResult,
} from './shape-tripwires';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** One `event-status` row. Remember: a row is a date, not a gameweek. */
function statusRow(
  event: number,
  date: string,
  leaguesUpdated: boolean,
): Record<string, unknown> {
  return {
    bonus_added: leaguesUpdated,
    date,
    event,
    leagues_updated: leaguesUpdated,
    points: leaguesUpdated ? 'r' : '',
  };
}

/** The fully scored GW1 the happy path probes run over. */
function scoredEventStatusBody(): Record<string, unknown> {
  return {
    status: [
      statusRow(1, '2026-08-21', true),
      statusRow(1, '2026-08-22', true),
      statusRow(1, '2026-08-23', true),
      statusRow(1, '2026-08-24', true),
    ],
    leagues: '',
  };
}

/** A live feed where every listed element played 90 minutes. */
function playedLive(count: number): Record<string, unknown> {
  return {
    elements: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        String(index + 1),
        { stats: { total_points: 6, minutes: 90 } },
      ]),
    ),
    fixtures: [],
  };
}

/** Managers with the real `id` versus `entry_id` split. */
function leagueDetailsBody(): Record<string, unknown> {
  const entries = Array.from({ length: 8 }, (_, index) => ({
    id: 39836 + index,
    entry_id: 39780 + index,
    entry_name: `Team ${index + 1}`,
  }));

  return {
    league_entries: entries,
    standings: entries.map((entry, index) => ({
      league_entry: entry.id,
      rank: index + 1,
      total: 100 - index,
      event_total: 50 - index,
    })),
  };
}

function pulseEntry(name: string): Record<string, unknown> {
  return {
    team: {
      name,
      id: 1,
      club: { name, abbr: name.slice(0, 3).toUpperCase(), id: 1 },
      altIds: { opta: 't3' },
    },
    position: 1,
    overall: {
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalsFor: 2,
      goalsAgainst: 0,
      goalsDifference: 2,
      points: 3,
    },
  };
}

/** A started Pulse season: gameWeek above zero with real totals. */
function startedPulseStandings(): Record<string, unknown> {
  return {
    compSeason: { id: 841, label: 'English Premier League Season 2026/2027' },
    tables: [{ gameWeek: 1, entries: [pulseEntry('Arsenal')] }],
  };
}

/** The real mixed label formats, in one response. */
function mixedLabelSeasons(): Record<string, unknown> {
  return {
    content: [
      { id: 841, label: 'English Premier League Season 2026/2027' },
      { id: 777, label: '2025/26' },
      { id: 719, label: '2024/25' },
    ],
  };
}

const ALL_PROBES: Array<(input: unknown) => TripwireResult> = [
  probeEventStatusShape,
  probeEventStatusRows,
  probeLiveElementsPresent,
  probeLiveElementsPlayed,
  probeStandingsIdentity,
  probePulseSeasonStarted,
  probePulseSeasonSelectable,
];

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('runDraftProbes', () => {
  it('passes fully scored gameweek payloads on every draft probe', () => {
    const results = runDraftProbes({
      eventStatusBody: scoredEventStatusBody(),
      liveData: playedLive(609),
      leagueDetails: leagueDetailsBody(),
    });

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.pass)).toBe(true);
  });

  it('fails every probe on missing inputs without throwing', () => {
    const results = runDraftProbes(null as unknown as DraftProbeInputs);

    expect(results).toHaveLength(5);
    expect(results.every((result) => !result.pass)).toBe(true);
  });
});

describe('runPulseProbes', () => {
  it('passes a started season with highest id selection', () => {
    const results = runPulseProbes(
      startedPulseStandings(),
      mixedLabelSeasons(),
    );

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.pass)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Uniform result shape
// ---------------------------------------------------------------------------

describe('probe result shape', () => {
  it('returns { name, pass, evidence } with distinct names from every probe', () => {
    const results: TripwireResult[] = [
      probeEventStatusShape(scoredEventStatusBody()),
      probeEventStatusRows(scoredEventStatusBody()),
      probeLiveElementsPresent(playedLive(3)),
      probeLiveElementsPlayed(playedLive(3)),
      probeStandingsIdentity(leagueDetailsBody()),
      probePulseSeasonStarted(startedPulseStandings()),
      probePulseSeasonSelectable(mixedLabelSeasons()),
    ];

    for (const result of results) {
      expect(typeof result.name).toBe('string');
      expect(typeof result.pass).toBe('boolean');
      expect(typeof result.evidence).toBe('string');
      expect(result.evidence.length).toBeGreaterThan(0);
    }

    const names = results.map((result) => result.name);

    expect(new Set(names).size).toBe(results.length);
  });

  it('keeps evidence bounded on pathological inputs', () => {
    const huge = 'x'.repeat(10_000);
    const results: TripwireResult[] = [
      probeEventStatusShape(huge),
      probeEventStatusRows({ status: [{ blob: huge }] }),
      probeLiveElementsPresent({ elements: {}, note: huge }),
      probeLiveElementsPlayed({ elements: {} }),
      probeStandingsIdentity({ league_entries: huge, standings: huge }),
      probePulseSeasonStarted({ tables: [{ gameWeek: huge, entries: [] }] }),
      probePulseSeasonSelectable({
        content: [{ id: huge, label: 'not a season' }],
      }),
    ];

    expect(results.every((result) => !result.pass)).toBe(true);

    for (const result of results) {
      expect(result.evidence.length).toBeLessThanOrEqual(
        TRIPWIRE_EVIDENCE_MAX_CHARS + 300,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Trap 1: event-status bare string body
// ---------------------------------------------------------------------------

describe('probeEventStatusShape', () => {
  it('fails the bare string 404 body with the string attached as evidence', () => {
    const result = probeEventStatusShape('Game not started');

    expect(result.pass).toBe(false);
    expect(result.evidence).toContain('Game not started');
  });

  it('passes the usual object shape', () => {
    expect(probeEventStatusShape(scoredEventStatusBody()).pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Trap 2: per date rows carrying the every row rule inputs
// ---------------------------------------------------------------------------

describe('probeEventStatusRows', () => {
  it('passes rows carrying event, date and leagues_updated', () => {
    expect(probeEventStatusRows(scoredEventStatusBody()).pass).toBe(true);
  });

  it('fails a row missing leagues_updated and names the row', () => {
    const body = scoredEventStatusBody();
    const rows = body.status as Record<string, unknown>[];
    // Row 2 rebuilt without its leagues_updated flag, as a renamed field
    // upstream would arrive.
    const tampered = rows.map((row, index) =>
      index === 2
        ? {
            bonus_added: row.bonus_added,
            date: row.date,
            event: row.event,
            points: row.points,
          }
        : row,
    );

    const result = probeEventStatusRows({ ...body, status: tampered });

    expect(result.pass).toBe(false);
    expect(result.evidence).toContain('row 2');
  });

  it('fails when there is no status array at all', () => {
    expect(probeEventStatusRows('Game not started').pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Trap 3: live elements empty object
// ---------------------------------------------------------------------------

describe('probeLiveElementsPresent', () => {
  it('fails {} elements with evidence attached', () => {
    const result = probeLiveElementsPresent({ elements: {}, fixtures: [] });

    expect(result.pass).toBe(false);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('passes a populated feed', () => {
    const result = probeLiveElementsPresent(playedLive(609));

    expect(result.pass).toBe(true);
    expect(result.evidence).toContain('609');
  });
});

// ---------------------------------------------------------------------------
// Trap 4: live elements fully zero with nobody played
// ---------------------------------------------------------------------------

describe('probeLiveElementsPlayed', () => {
  it('fails 609 elements all on nil minutes with evidence attached', () => {
    const feed = {
      elements: Object.fromEntries(
        Array.from({ length: 609 }, (_, index) => [
          String(index + 1),
          { stats: { total_points: 0, minutes: 0 } },
        ]),
      ),
    };

    const result = probeLiveElementsPlayed(feed);

    expect(result.pass).toBe(false);
    expect(result.evidence).toContain('609');
  });

  it('passes once anyone has taken the field', () => {
    expect(probeLiveElementsPlayed(playedLive(609)).pass).toBe(true);
  });

  it('counts a goalless appearance as played, via the minutes signal', () => {
    const feed = {
      elements: {
        '1': { stats: { total_points: 0, minutes: 90 } },
        '2': { stats: { total_points: 0, minutes: 0 } },
      },
    };

    const result = probeLiveElementsPlayed(feed);

    expect(result.pass).toBe(true);
    expect(result.evidence).toContain('1 of 2');
  });

  it('counts a scorer who somehow shows nil minutes as played, via total points', () => {
    const feed = {
      elements: {
        '1': { stats: { total_points: 8, minutes: 0 } },
      },
    };

    expect(probeLiveElementsPlayed(feed).pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Trap 5: league entry id versus entry_id resolution
// ---------------------------------------------------------------------------

describe('probeStandingsIdentity', () => {
  it('passes standings rows referencing league entry ids', () => {
    expect(probeStandingsIdentity(leagueDetailsBody()).pass).toBe(true);
  });

  it('fails standings rows referencing entry_id values instead', () => {
    const details = leagueDetailsBody();
    const entries = details.league_entries as { entry_id: number }[];

    const result = probeStandingsIdentity({
      ...details,
      standings: entries.map((entry) => ({ league_entry: entry.entry_id })),
    });

    expect(result.pass).toBe(false);
    expect(result.evidence).toContain('team ids');
  });

  it('fails a standings row with no numeric league_entry', () => {
    const details = leagueDetailsBody();

    expect(
      probeStandingsIdentity({
        ...details,
        standings: [{ league_entry: '39837' }],
      }).pass,
    ).toBe(false);
  });

  it('names the known-entry count when ids match neither table', () => {
    const details = leagueDetailsBody();

    const result = probeStandingsIdentity({
      ...details,
      standings: [{ league_entry: 39999 }],
    });

    expect(result.pass).toBe(false);
    expect(result.evidence).toContain('known entries');
  });
});

// ---------------------------------------------------------------------------
// Trap 6: Pulse gameWeek zero pre season
// ---------------------------------------------------------------------------

describe('probePulseSeasonStarted', () => {
  it('fails twenty clubs on noughts with gameWeek zero', () => {
    const clubs = Array.from({ length: 20 }, (_, index) =>
      pulseEntry(`Club ${index + 1}`),
    );
    const table = {
      compSeason: { id: 841, label: 'English Premier League Season 2026/2027' },
      tables: [
        {
          gameWeek: 0,
          entries: clubs.map((club) => ({
            ...club,
            overall: {
              played: 0,
              won: 0,
              drawn: 0,
              lost: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              goalsDifference: 0,
              points: 0,
            },
          })),
        },
      ],
    };

    const result = probePulseSeasonStarted(table);

    expect(result.pass).toBe(false);
    expect(result.evidence).toContain('20 entries');
  });

  it('passes once the first gameweek is played', () => {
    expect(probePulseSeasonStarted(startedPulseStandings()).pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Trap 7: Pulse season selection by highest id
// ---------------------------------------------------------------------------

describe('probePulseSeasonSelectable', () => {
  it('selects the highest id across mixed label formats', () => {
    const result = probePulseSeasonSelectable(mixedLabelSeasons());

    expect(result.pass).toBe(true);
    expect(result.evidence).toContain('841');
  });

  it('fails an empty season list', () => {
    expect(probePulseSeasonSelectable({ content: [] }).pass).toBe(false);
  });

  it('fails when no listed season carries a numeric id', () => {
    expect(
      probePulseSeasonSelectable({ content: [{ id: 'latest', label: 'x' }] })
        .pass,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fail closed
// ---------------------------------------------------------------------------

describe('probes fail closed', () => {
  it.each([undefined, null, 42, 'oops', []])(
    'fails every probe on malformed input %# without throwing',
    (input) => {
      for (const probe of ALL_PROBES) {
        const result = probe(input);

        expect(result.pass).toBe(false);
        expect(typeof result.evidence).toBe('string');
      }
    },
  );

  it('fails every draft probe on missing inputs without throwing', () => {
    const results = runDraftProbes({
      eventStatusBody: undefined,
      liveData: null,
      leagueDetails: {},
    });

    expect(results).toHaveLength(5);
    expect(results.every((result) => !result.pass)).toBe(true);
  });

  it('fails every Pulse probe on missing inputs without throwing', () => {
    const results = runPulseProbes(undefined, null);

    expect(results).toHaveLength(2);
    expect(results.every((result) => !result.pass)).toBe(true);
  });
});
