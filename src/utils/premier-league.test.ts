import { describe, expect, it } from 'vitest';

import type {
  PulseFixture,
  PulseStandingsEntry,
  PulseStandingsResponse,
  PulseTeam,
} from '@/interfaces/premier-league';
import {
  formFrom,
  groupByGameweek,
  hasSeasonStarted,
  newestCompSeasonId,
  optaTeamCode,
  pickCurrentGameweek,
  toClub,
  toFixture,
  toLeagueTableRow,
} from './premier-league';

function team(id: number, opta: string, name = `Club ${id}`): PulseTeam {
  return {
    name,
    shortName: name,
    id,
    club: { name, shortName: name, abbr: name.slice(0, 3).toUpperCase(), id },
    altIds: { opta },
  };
}

function fixture(overrides: Partial<PulseFixture> = {}): PulseFixture {
  return {
    id: 1,
    status: 'C',
    gameweek: { gameweek: 1, compSeason: { id: 841 } },
    kickoff: { millis: 1_000 },
    teams: [
      { team: team(1, 't3'), score: 2 },
      { team: team(2, 't7'), score: 0 },
    ],
    altIds: { opta: 'g1' },
    ...overrides,
  };
}

function entry(overrides: Partial<PulseStandingsEntry> = {}) {
  return {
    team: team(1, 't3', 'Arsenal'),
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
    home: {
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalsFor: 2,
      goalsAgainst: 0,
      goalsDifference: 2,
      points: 3,
    },
    away: {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalsDifference: 0,
      points: 0,
    },
    form: [],
    ...overrides,
  } satisfies PulseStandingsEntry;
}

describe('optaTeamCode', () => {
  it('recovers the crest code from a Pulse alt-ID', () => {
    // Verified against all 20 clubs: Pulse's opta alt-ID is `t` plus exactly
    // the `teams[].code` FPL uses, which is what `clubCrestUrl` takes.
    expect(optaTeamCode('t3')).toBe(3);
    expect(optaTeamCode('t91')).toBe(91);
  });

  it('rejects anything that is not that shape', () => {
    for (const bad of ['', 'p123', '3', 't', 'tt3', 't3x', undefined]) {
      expect(optaTeamCode(bad)).toBeNull();
    }
  });
});

describe('toClub', () => {
  it('drops a club it cannot map rather than inventing a code', () => {
    // The only consumer of `code` is a crest URL, and the asset host answers a
    // wrong code with 403 — a broken image and nothing in the log.
    expect(toClub({ ...team(1, 'nonsense') })).toBeNull();
    expect(toClub(undefined)).toBeNull();
  });

  it('keeps the club name over the team name', () => {
    expect(toClub(team(10, 't14', 'Liverpool'))?.name).toBe('Liverpool');
    expect(toClub(team(10, 't14'))?.code).toBe(14);
  });
});

describe('hasSeasonStarted', () => {
  const twentyClubsOnZero: PulseStandingsResponse = {
    compSeason: { id: 841, label: 'English Premier League Season 2026/2027' },
    tables: [
      { gameWeek: 0, entries: Array.from({ length: 20 }, () => entry()) },
    ],
  };

  it('is false pre-season, when upstream still returns a full table', () => {
    // The trap this exists for: `entries.length` is 20 in August. A truthy or
    // length check answers "we have a table" about a page of noughts.
    expect(twentyClubsOnZero.tables[0].entries).toHaveLength(20);
    expect(hasSeasonStarted(twentyClubsOnZero)).toBe(false);
  });

  it('is true once a gameweek has been played', () => {
    expect(
      hasSeasonStarted({
        ...twentyClubsOnZero,
        tables: [{ ...twentyClubsOnZero.tables[0], gameWeek: 1 }],
      }),
    ).toBe(true);
  });

  it('is false for a response with no tables at all', () => {
    expect(
      hasSeasonStarted({ compSeason: { id: 1, label: '' }, tables: [] }),
    ).toBe(false);
  });
});

describe('formFrom', () => {
  it('reads a win from the side the club was on, not from the outcome', () => {
    const home = formFrom(
      entry({
        form: [fixture({ outcome: 'H' })],
      }),
    );
    expect(home).toEqual(['W']);

    // Same fixture, same `outcome: 'H'` — but this club was the away side.
    const away = formFrom(
      entry({
        team: team(2, 't7'),
        form: [fixture({ outcome: 'H' })],
      }),
    );
    expect(away).toEqual(['L']);
  });

  it('orders oldest first regardless of how upstream sent them', () => {
    expect(
      formFrom(
        entry({
          form: [
            fixture({ id: 2, outcome: 'D', kickoff: { millis: 5_000 } }),
            fixture({ id: 1, outcome: 'H', kickoff: { millis: 1_000 } }),
          ],
        }),
      ),
    ).toEqual(['W', 'D']);
  });

  it('ignores a fixture with no outcome or one the club is not in', () => {
    expect(
      formFrom(
        entry({
          form: [
            fixture({ outcome: undefined }),
            fixture({
              outcome: 'H',
              teams: [{ team: team(8, 't11') }, { team: team(9, 't31') }],
            }),
          ],
        }),
      ),
    ).toEqual([]);
  });
});

describe('toLeagueTableRow', () => {
  it('reads movement as places gained, so a rise is positive', () => {
    // Position 3 having started the gameweek 1st is a fall of two.
    expect(
      toLeagueTableRow(entry({ position: 3, startingPosition: 1 }))?.movement,
    ).toBe(-2);
    expect(
      toLeagueTableRow(entry({ position: 1, startingPosition: 4 }))?.movement,
    ).toBe(3);
  });

  it('leaves movement null pre-season rather than claiming zero', () => {
    expect(toLeagueTableRow(entry())?.movement).toBeNull();
  });
});

describe('toFixture', () => {
  it('keeps a nil-nil as a played result, not as unplayed', () => {
    // `0` is a real score. A truthiness check here would render a completed
    // goalless draw as a fixture yet to kick off.
    const goalless = toFixture(
      fixture({
        outcome: 'D',
        teams: [
          { team: team(1, 't3'), score: 0 },
          { team: team(2, 't7'), score: 0 },
        ],
      }),
    );

    expect(goalless?.homeScore).toBe(0);
    expect(goalless?.awayScore).toBe(0);
  });

  it('leaves both scores null for an upcoming fixture', () => {
    const upcoming = toFixture(
      fixture({
        status: 'U',
        outcome: undefined,
        teams: [{ team: team(1, 't3') }, { team: team(2, 't7') }],
      }),
    );

    expect(upcoming?.homeScore).toBeNull();
    expect(upcoming?.awayScore).toBeNull();
  });

  it('shows a clock only while a match is live', () => {
    const clock = { secs: 5_700, label: "90+5'00" };

    expect(toFixture(fixture({ status: 'L', clock }))?.clockLabel).toBe(
      "90+5'00",
    );
    // A completed match still carries `90+5'00`, which as a badge reads as
    // in-progress.
    expect(toFixture(fixture({ status: 'C', clock }))?.clockLabel).toBeNull();
  });

  it('drops a fixture whose clubs cannot be mapped', () => {
    expect(
      toFixture(
        fixture({
          teams: [{ team: team(1, 'bad') }, { team: team(2, 't7') }],
        }),
      ),
    ).toBeNull();
  });

  it('treats teams as [home, away] by position', () => {
    const mapped = toFixture(fixture());

    expect(mapped?.home.code).toBe(3);
    expect(mapped?.away.code).toBe(7);
  });
});

describe('groupByGameweek', () => {
  const mapped = [
    fixture({ id: 3, gameweek: { gameweek: 2, compSeason: { id: 1 } } }),
    fixture({
      id: 2,
      gameweek: { gameweek: 1, compSeason: { id: 1 } },
      kickoff: { millis: 9_000 },
    }),
    fixture({
      id: 1,
      gameweek: { gameweek: 1, compSeason: { id: 1 } },
      kickoff: { millis: 2_000 },
    }),
  ]
    .map(toFixture)
    .flatMap((f) => (f ? [f] : []));

  it('orders gameweeks, and fixtures by kick-off within them', () => {
    const grouped = groupByGameweek(mapped);

    expect(grouped.map((week) => week.gameweek)).toEqual([1, 2]);
    expect(grouped[0].fixtures.map((f) => f.id)).toEqual([1, 2]);
  });

  it('drops an unscheduled fixture rather than inventing gameweek 0', () => {
    const orphan = toFixture(
      fixture({ id: 9, gameweek: { gameweek: 0, compSeason: { id: 1 } } }),
    );

    expect(groupByGameweek([...mapped, orphan!])).toHaveLength(2);
  });
});

describe('pickCurrentGameweek', () => {
  const week = (gameweek: number, fixtures: Partial<PulseFixture>[]) => ({
    gameweek,
    fixtures: fixtures
      .map((f) =>
        toFixture(
          fixture({ ...f, gameweek: { gameweek, compSeason: { id: 1 } } }),
        ),
      )
      .flatMap((f) => (f ? [f] : [])),
  });

  it('prefers a gameweek with a match in progress', () => {
    const weeks = [
      week(1, [{ status: 'C' }]),
      week(2, [{ status: 'L' }]),
      week(3, [{ status: 'U', kickoff: { millis: 100 } }]),
    ];

    expect(pickCurrentGameweek(weeks, 50)).toBe(2);
  });

  it('otherwise lands on the next round still to be played', () => {
    // The Tuesday case: last weekend is done, and the useful tab is what is
    // coming rather than gameweek 1.
    const weeks = [
      week(1, [{ status: 'C' }]),
      week(2, [{ status: 'C' }]),
      week(3, [{ status: 'U', kickoff: { millis: 9_000 } }]),
    ];

    expect(pickCurrentGameweek(weeks, 5_000)).toBe(3);
  });

  it('falls back to the last gameweek once the season is over', () => {
    const weeks = [week(37, [{ status: 'C' }]), week(38, [{ status: 'C' }])];

    expect(pickCurrentGameweek(weeks, 10_000)).toBe(38);
  });

  it('does not throw on an empty season', () => {
    expect(pickCurrentGameweek([], 0)).toBe(1);
  });
});

describe('newestCompSeasonId', () => {
  it('picks by ID, never by parsing the label', () => {
    // Pulse's labels are not one format. These two are real, and adjacent.
    expect(
      newestCompSeasonId({
        content: [
          { id: 841, label: 'English Premier League Season 2026/2027' },
          { id: 777, label: '2025/26' },
          { id: 719, label: '2024/25' },
        ],
      }),
    ).toBe(841);
  });

  it('is null when Pulse lists nothing', () => {
    expect(newestCompSeasonId({ content: [] })).toBeNull();
  });
});
