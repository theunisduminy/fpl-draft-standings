import { describe, expect, it } from 'vitest';

import {
  asElementCode,
  asElementId,
  asEntryId,
  asLeagueEntryId,
  type DraftChoice,
  type DraftInfo,
  type ElementCode,
  type ElementStatus,
  type EntryId,
  type LeagueEntryId,
} from '@/interfaces/fpl';
import {
  draftForGameweek,
  toDraftPickRow,
  toDraftPickRows,
  toOwnershipSnapshotRow,
  toOwnershipSnapshotRows,
} from './draft-lineage';

/**
 * The pure half of the draft-to-waiver lineage.
 *
 * Two fixtures do all the work, straight from `agents/API.md`: the August
 * draft (id 8911, event 1) and the scheduled re-draft (id 32922, event 24).
 * Every selector test is a question about which of the two a gameweek
 * belongs to — and the trap being pinned is reading `drafts[0]`, which
 * answers "August" for a gameweek played in March.
 */

function draft(id: number, event: number, started = true): DraftInfo {
  return {
    id,
    event,
    draft_started: started,
    draft_completed: started ? '2026-08-12T19:56:25.910800Z' : null,
  };
}

/** The observed `drafts[]` list: August plus the GW24 re-draft. */
const AUGUST_DRAFT = draft(8911, 1);
const REDRAFT = draft(32922, 24, false);
const DRAFTS: DraftInfo[] = [AUGUST_DRAFT, REDRAFT];

function choice(overrides: Partial<DraftChoice> = {}): DraftChoice {
  return {
    element: asElementId(101),
    entry: asEntryId(39781),
    round: 1,
    pick: 3,
    index: 3,
    was_auto: false,
    seconds_to_pick: 42,
    ...overrides,
  };
}

function status(owner: EntryId | null): ElementStatus {
  return {
    element: asElementId(101),
    owner,
    status: owner === null ? 'a' : 'o',
    in_accepted_trade: false,
  };
}

const SAKA_CODE = asElementCode(223094);

function codeByElement(
  entries: [number, ElementCode][] = [[101, SAKA_CODE]],
): Map<number, ElementCode> {
  return new Map(entries);
}

function leagueEntryByEntry(
  entries: [number, LeagueEntryId][] = [[39781, asLeagueEntryId(39837)]],
): Map<number, LeagueEntryId> {
  return new Map(entries);
}

describe('draftForGameweek', () => {
  it('attributes a pre re-draft gameweek to the August draft', () => {
    expect(draftForGameweek(DRAFTS, 10)?.id).toBe(8911);
  });

  it('attributes the re-draft gameweek and later ones to the GW24 draft', () => {
    expect(draftForGameweek(DRAFTS, 24)?.id).toBe(32922);
    expect(draftForGameweek(DRAFTS, 30)?.id).toBe(32922);
  });

  it('returns null for gameweek 0 and for an empty drafts list', () => {
    // Gameweek 0 is before every draft; defaulting to the first draft would
    // attribute a gameweek played under no draft to the August one.
    expect(draftForGameweek(DRAFTS, 0)).toBeNull();
    expect(draftForGameweek([], 10)).toBeNull();
  });

  it('resolves by event, not by input order', () => {
    // The payload order is not the contract — `drafts[0]` happens to be the
    // August draft today, and the selector must not notice if it stops.
    const reversed: DraftInfo[] = [REDRAFT, AUGUST_DRAFT];

    expect(draftForGameweek(reversed, 10)?.id).toBe(8911);
    expect(draftForGameweek(reversed, 30)?.id).toBe(32922);
  });

  it('attributes a gameweek between two draft events to the earlier draft', () => {
    expect(draftForGameweek(DRAFTS, 15)?.id).toBe(8911);
    expect(draftForGameweek(DRAFTS, 23)?.id).toBe(8911);
  });

  it('returns null below the earliest draft event rather than throwing', () => {
    // A gameweek before any draft is unattributable. Callers treat null as
    // "no draft to seed or snapshot against" — never an exception.
    const lateStarters: DraftInfo[] = [draft(55, 5), draft(56, 24)];

    expect(draftForGameweek(lateStarters, 3)).toBeNull();
  });
});

describe('toDraftPickRow', () => {
  it('turns one choice plus resolved codes into a draft pick fact', () => {
    const row = toDraftPickRow(choice(), {
      leagueId: 8337,
      draftId: 8911,
      draftEvent: 1,
      elementCode: SAKA_CODE,
    });

    expect(row).toMatchObject({
      leagueId: 8337,
      draftId: 8911,
      draftIndex: 3,
      draftEvent: 1,
      round: 1,
      pick: 3,
      entry: 39781,
      elementId: 101,
      elementCode: 223094,
      wasAuto: false,
      secondsToPick: 42,
    });
  });

  it('stores a null seconds_to_pick as-is', () => {
    // Upstream sends null often enough that the column is nullable; the
    // mapping must carry it through rather than inventing a zero.
    const row = toDraftPickRow(choice({ seconds_to_pick: null }), {
      leagueId: 8337,
      draftId: 8911,
      draftEvent: 1,
      elementCode: SAKA_CODE,
    });

    expect(row?.secondsToPick).toBeNull();
  });

  it('drops a choice whose element has no resolvable code', () => {
    // A pick stored with a null code could never join — every read joins on
    // stable codes — so the seed set drops it instead of persisting a row
    // that reads as coverage while answering nothing.
    expect(
      toDraftPickRow(choice(), {
        leagueId: 8337,
        draftId: 8911,
        draftEvent: 1,
        elementCode: null,
      }),
    ).toBeNull();
  });

  it('seeds a batch while dropping only the unresolvable choices', () => {
    const rows = toDraftPickRows(
      [choice(), choice({ element: asElementId(102), index: 4 })],
      {
        leagueId: 8337,
        draftId: 8911,
        draftEvent: 1,
        codeByElement: codeByElement(),
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ elementId: 101, draftIndex: 3 });
  });
});

describe('toOwnershipSnapshotRow', () => {
  it('turns one owned status plus its resolved owner into a snapshot fact', () => {
    const row = toOwnershipSnapshotRow(status(asEntryId(39781)), {
      leagueId: 8337,
      gameweek: 5,
      elementCode: SAKA_CODE,
      ownerLeagueEntry: asLeagueEntryId(39837),
    });

    expect(row).toMatchObject({
      leagueId: 8337,
      gameweek: 5,
      elementCode: 223094,
      elementId: 101,
      ownerEntry: 39781,
      ownerLeagueEntry: 39837,
    });
  });

  it('snapshots a free agent with both owner columns null', () => {
    // Unowned is a fact, not a gap: the row says who did not own the player
    // as loudly as an owned row says who did.
    const row = toOwnershipSnapshotRow(status(null), {
      leagueId: 8337,
      gameweek: 5,
      elementCode: SAKA_CODE,
      ownerLeagueEntry: asLeagueEntryId(39837),
    });

    expect(row).toMatchObject({ ownerEntry: null, ownerLeagueEntry: null });
  });

  it('keeps the entry id when the owner resolves to no league entry', () => {
    // The entries list is read live at snapshot time; an owner it does not
    // name keeps its season-scoped id with a null resolution rather than
    // dropping the fact.
    const row = toOwnershipSnapshotRow(status(asEntryId(39781)), {
      leagueId: 8337,
      gameweek: 5,
      elementCode: SAKA_CODE,
      ownerLeagueEntry: null,
    });

    expect(row).toMatchObject({
      ownerEntry: 39781,
      ownerLeagueEntry: null,
    });
  });

  it('drops a status whose element has no resolvable code', () => {
    expect(
      toOwnershipSnapshotRow(status(null), {
        leagueId: 8337,
        gameweek: 5,
        elementCode: null,
        ownerLeagueEntry: null,
      }),
    ).toBeNull();
  });

  it('snapshots a batch, resolving owners through the same run’s entries', () => {
    const rows = toOwnershipSnapshotRows(
      [status(asEntryId(39781)), status(null)],
      {
        leagueId: 8337,
        gameweek: 5,
        codeByElement: codeByElement(),
        leagueEntryByEntry: leagueEntryByEntry(),
      },
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      ownerEntry: 39781,
      ownerLeagueEntry: 39837,
    });
    expect(rows[1]).toMatchObject({
      ownerEntry: null,
      ownerLeagueEntry: null,
    });
  });

  it('keeps an unknown owner’s entry id in the batch instead of dropping it', () => {
    const rows = toOwnershipSnapshotRows([status(asEntryId(39999))], {
      leagueId: 8337,
      gameweek: 5,
      codeByElement: codeByElement(),
      leagueEntryByEntry: leagueEntryByEntry(),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ownerEntry: 39999,
      ownerLeagueEntry: null,
    });
  });
});
