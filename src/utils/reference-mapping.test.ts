import { describe, expect, it } from 'vitest';

import {
  REFERENCE_STALE_AFTER_SECONDS,
  isReferenceUsable,
  latestSync,
  toElementRows,
  toTeamRows,
  toElementDetails,
  toPlTeam,
} from './reference-mapping';
import {
  asElementCode,
  asElementId,
  asTeamCode,
  type DraftBootstrap,
} from '@/interfaces/fpl';
import type { DraftElementRow, PlTeamRow } from '@/server/db/schema';

/**
 * The pure half of the reference cache.
 *
 * Everything worth pinning about this feature is here, for the same reason the
 * scoring layer was extracted: a rule that only exists inside an `async`
 * function wrapped around an 850 KB download and a database round trip cannot
 * be tested, and every rule below is one whose violation is silent.
 */

const NOW = new Date('2026-08-14T12:00:00Z');

function bootstrap(overrides: Partial<DraftBootstrap> = {}): DraftBootstrap {
  return {
    elements: [
      {
        id: asElementId(101),
        code: asElementCode(223094),
        web_name: 'Saka',
        first_name: 'Bukayo',
        second_name: 'Saka',
        team: 1,
        element_type: 3,
        total_points: 47,
      },
      {
        id: asElementId(102),
        code: asElementCode(118748),
        web_name: 'Raya',
        first_name: 'David',
        second_name: 'Raya Martin',
        team: 1,
        element_type: 1,
        total_points: 31,
      },
    ],
    teams: [{ id: 1, code: asTeamCode(3), name: 'Arsenal', short_name: 'ARS' }],
    element_types: [
      { id: 1, singular_name_short: 'GKP', singular_name: 'Goalkeeper' },
      { id: 3, singular_name_short: 'MID', singular_name: 'Midfielder' },
    ],
    ...overrides,
  } as DraftBootstrap;
}

function elementRow(overrides: Partial<DraftElementRow> = {}): DraftElementRow {
  return {
    leagueId: 8337,
    elementId: 101,
    code: 223094,
    webName: 'Saka',
    position: 'MID',
    teamCode: 3,
    totalPoints: 47,
    syncedAt: NOW,
    ...overrides,
  };
}

describe('toElementRows', () => {
  it('carries code, name, position and team code onto the row', () => {
    const [saka] = toElementRows(bootstrap(), 8337);

    expect(saka).toMatchObject({
      leagueId: 8337,
      elementId: 101,
      code: 223094,
      webName: 'Saka',
      position: 'MID',
      teamCode: 3,
      totalPoints: 47,
    });
  });

  it('resolves the club by id but stores the season-stable code', () => {
    // The bootstrap addresses clubs by `teams[].id` (1), and `id` is re-minted
    // every August. Storing 1 would repoint this row at whichever club sorted
    // first next season; storing code 3 keeps it Arsenal for good.
    const [saka] = toElementRows(bootstrap(), 8337);

    expect(saka.teamCode).toBe(3);
    expect(saka.teamCode).not.toBe(1);
  });

  it('maps an unknown element_type to UNK rather than throwing', () => {
    const payload = bootstrap();
    payload.elements[0].element_type = 99;

    expect(toElementRows(payload, 8337)[0].position).toBe('UNK');
  });

  it('drops an element whose club is not in the payload', () => {
    // A row with no resolvable club cannot answer the club column, and a
    // half-populated table is worse than an absent one: it reads as complete.
    const payload = bootstrap();
    payload.elements[0].team = 99;

    expect(toElementRows(payload, 8337).map((row) => row.elementId)).toEqual([
      102,
    ]);
  });

  it('produces zero rows from a bootstrap with no elements', () => {
    // `{}` and `[]` from upstream mean "nothing yet", never "has data".
    expect(toElementRows(bootstrap({ elements: [] }), 8337)).toEqual([]);
  });
});

describe('toTeamRows', () => {
  it('maps the 20 clubs onto rows keyed by code', () => {
    expect(toTeamRows(bootstrap(), 8337)).toEqual([
      { leagueId: 8337, code: 3, name: 'Arsenal', shortName: 'ARS' },
    ]);
  });

  it('produces zero rows from a bootstrap with no teams', () => {
    expect(toTeamRows(bootstrap({ teams: [] }), 8337)).toEqual([]);
  });
});

describe('toElementDetails', () => {
  it('round-trips the element code, so the photo URL is unchanged', () => {
    const details = toElementDetails(
      elementRow(),
      new Map([
        [3, { code: asTeamCode(3), name: 'Arsenal', short_name: 'ARS' }],
      ]),
    );

    expect(details.code).toBe(223094);
    expect(details).toMatchObject({
      name: 'Saka',
      position: 'MID',
      club: 'ARS',
    });
  });

  it('falls back to the em dash when the club is missing', () => {
    const details = toElementDetails(elementRow(), new Map());

    expect(details.club).toBe('—');
  });

  it('keeps a stored position that is not in the union as UNK', () => {
    const details = toElementDetails(
      elementRow({ position: 'nonsense' }),
      new Map(),
    );

    expect(details.position).toBe('UNK');
  });
});

describe('toPlTeam', () => {
  it('re-brands the code coming back out of the driver', () => {
    const row: PlTeamRow = {
      leagueId: 8337,
      code: 3,
      name: 'Arsenal',
      shortName: 'ARS',
      syncedAt: NOW,
    };

    expect(toPlTeam(row)).toEqual({
      code: 3,
      name: 'Arsenal',
      short_name: 'ARS',
    });
  });
});

describe('latestSync', () => {
  const fresh = NOW;
  const ancient = new Date(NOW.getTime() - 400 * 24 * 3600 * 1000);

  it('returns null for no rows', () => {
    expect(latestSync([])).toBeNull();
  });

  it('reports the newest stamp, not the oldest', () => {
    // The regression this exists for. `upsertElements` never prunes, so a
    // footballer who drops out of the bootstrap keeps their old stamp forever.
    // Reading the oldest would pin the whole table `stale` for the rest of the
    // season — every read back to the 850 KB bootstrap, sync still reporting
    // success. One orphan must not outvote 586 rows written seconds ago.
    expect(
      latestSync([
        { syncedAt: ancient },
        { syncedAt: fresh },
        { syncedAt: fresh },
      ]),
    ).toEqual(fresh);
  });

  it('leaves a genuinely old table stale', () => {
    expect(latestSync([{ syncedAt: ancient }])).toEqual(ancient);
  });

  it('is order-independent', () => {
    expect(latestSync([{ syncedAt: fresh }, { syncedAt: ancient }])).toEqual(
      latestSync([{ syncedAt: ancient }, { syncedAt: fresh }]),
    );
  });
});

describe('an orphaned row does not condemn the table', () => {
  it('stays usable when one stale row sits among fresh ones', () => {
    // End to end over the two pure pieces the DAL composes: pick the stamp,
    // then judge it. Fresh table, one leftover element, still usable.
    const rows = [
      elementRow({ elementId: 101, syncedAt: NOW }),
      elementRow({
        elementId: 999,
        syncedAt: new Date(NOW.getTime() - 400 * 24 * 3600 * 1000),
      }),
    ];

    expect(isReferenceUsable(rows, latestSync(rows), NOW).usable).toBe(true);
  });
});

describe('isReferenceUsable', () => {
  const fresh = NOW;

  it('returns empty for no rows, whatever the timestamp', () => {
    expect(isReferenceUsable([], fresh, NOW)).toEqual({
      usable: false,
      reason: 'empty',
    });
  });

  it('returns empty for no rows even with no timestamp at all', () => {
    expect(isReferenceUsable([], null, NOW)).toEqual({
      usable: false,
      reason: 'empty',
    });
  });

  it('returns stale past the budget', () => {
    const old = new Date(
      NOW.getTime() - (REFERENCE_STALE_AFTER_SECONDS + 1) * 1000,
    );

    expect(isReferenceUsable([elementRow()], old, NOW)).toMatchObject({
      usable: false,
      reason: 'stale',
    });
  });

  it('treats a row set exactly at the budget boundary as fresh', () => {
    // The boundary is inclusive on purpose: a cron firing on the budget must
    // not race a reader into a fallback it does not need.
    const boundary = new Date(
      NOW.getTime() - REFERENCE_STALE_AFTER_SECONDS * 1000,
    );

    expect(isReferenceUsable([elementRow()], boundary, NOW).usable).toBe(true);
  });

  it('returns stale one second past the boundary', () => {
    const past = new Date(
      NOW.getTime() - (REFERENCE_STALE_AFTER_SECONDS + 1) * 1000,
    );

    expect(isReferenceUsable([elementRow()], past, NOW).usable).toBe(false);
  });

  it('returns incomplete, naming the missing id, when one is absent', () => {
    const result = isReferenceUsable([elementRow()], fresh, NOW, [
      asElementId(101),
      asElementId(999),
    ]);

    expect(result).toMatchObject({ usable: false, reason: 'incomplete' });
    expect(result.usable === false && result.detail).toContain('999');
  });

  it('is usable when every requested id is present and fresh', () => {
    expect(
      isReferenceUsable([elementRow()], fresh, NOW, [asElementId(101)]).usable,
    ).toBe(true);
  });

  it('is usable with no id list at all — the club read has nothing to miss', () => {
    expect(isReferenceUsable([elementRow()], fresh, NOW).usable).toBe(true);
  });

  it('is usable when the requested list is empty', () => {
    // A manager with no squad yet is not a reason to download 850 KB.
    expect(isReferenceUsable([elementRow()], fresh, NOW, []).usable).toBe(true);
  });

  it('treats a missing timestamp on a populated table as stale', () => {
    // Rows we cannot date are rows we cannot vouch for.
    expect(isReferenceUsable([elementRow()], null, NOW)).toMatchObject({
      usable: false,
      reason: 'stale',
    });
  });
});
