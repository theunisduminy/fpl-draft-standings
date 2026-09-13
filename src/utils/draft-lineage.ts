import type {
  DraftChoice,
  DraftInfo,
  ElementCode,
  ElementStatus,
  LeagueEntryId,
} from '@/interfaces/fpl';
import type {
  NewDraftPickRow,
  NewOwnershipSnapshotRow,
} from '@/server/db/schema';

/**
 * The pure half of the draft-to-waiver lineage: which draft a gameweek
 * belongs to, and payload in, rows out.
 *
 * **No database and no fetch in this file**, deliberately — the same split
 * that made `reference-mapping.ts` testable. Every rule here fails silently
 * when broken: a gameweek attributed to the wrong draft, a pick stored
 * against a null code that can never join, a snapshot that re-resolves its
 * owner live instead of carrying the answer. The DAL moves these rows; this
 * module gives them meaning.
 *
 * ## Why the selector exists
 *
 * The season holds two drafts: the August draft at `event` 1 and the re-draft
 * at `event` 24. The choices endpoint is league-scoped, not draft-scoped, so
 * nothing upstream says which draft a row came from — the only signal is the
 * draft's `event` against the gameweek being stored. `draftForGameweek` is
 * the one place that decision lives.
 */

type DraftPickContext = {
  leagueId: number;
  draftId: number;
  draftEvent: number;
  /**
   * The choice's element resolved to its stable code, or null when the
   * element lookup cannot name it. Null drops the row rather than storing a
   * pick that can never join — see `toDraftPickRow`.
   */
  elementCode: ElementCode | null | undefined;
};

type OwnershipSnapshotContext = {
  leagueId: number;
  gameweek: number;
  /**
   * The status row's element resolved to its stable code, or null when the
   * element lookup cannot name it. Null drops the row: `element_code` is the
   * snapshot key, and a row keyed on nothing answers no question.
   */
  elementCode: ElementCode | null | undefined;
  /**
   * The owner's `entry_id` resolved against the same run's league entries, or
   * null for a free agent — and for an owned element whose entry appears in
   * no entry list, where keeping the season-scoped id while resolving nothing
   * is the honest row. Resolved by the caller so this module never fetches.
   */
  ownerLeagueEntry: LeagueEntryId | null | undefined;
};

/**
 * Which draft a gameweek attributes to: the draft with the greatest `event`
 * at or below the gameweek.
 *
 * Returns null when no draft qualifies — an empty list, or a gameweek below
 * the earliest draft event — and callers treat that as unattributable rather
 * than throwing. Defaulting to the first draft would silently attribute
 * pre-draft gameweeks to a draft that had not happened.
 *
 * Input order is irrelevant; the comparison is on `event`, never position.
 * Do not read `drafts[0]` — see `agents/API.md`.
 */
export function draftForGameweek(
  drafts: readonly DraftInfo[],
  gameweek: number,
): DraftInfo | null {
  let winner: DraftInfo | null = null;

  for (const draft of drafts) {
    if (draft.event > gameweek) continue;
    if (winner !== null && draft.event <= winner.event) continue;
    winner = draft;
  }

  return winner;
}

/**
 * One draft choice plus its resolved codes to a draft pick fact.
 *
 * Returns null when the element has no resolvable code. A pick stored with a
 * null code could never join at render time — every read joins on stable
 * codes — so the seed set drops it instead of persisting a row that reads as
 * coverage while answering nothing. No derived values: every column is the
 * choice's own field or an already-resolved identity.
 */
export function toDraftPickRow(
  choice: DraftChoice,
  context: DraftPickContext,
): NewDraftPickRow | null {
  if (context.elementCode == null) return null;

  return {
    leagueId: context.leagueId,
    draftId: context.draftId,
    draftIndex: choice.index,
    draftEvent: context.draftEvent,
    round: choice.round,
    pick: choice.pick,
    entry: choice.entry,
    elementId: choice.element,
    elementCode: context.elementCode,
    wasAuto: choice.was_auto,
    secondsToPick: choice.seconds_to_pick,
  };
}

/**
 * A choices payload to its seed rows, dropping choices whose element has no
 * resolvable code rather than storing them with a null key.
 *
 * Attribution (which draft id and event these rows belong to) is the
 * caller's: it comes from `draftForGameweek`, not from the choices, which
 * carry no draft of their own.
 */
export function toDraftPickRows(
  choices: readonly DraftChoice[],
  context: {
    leagueId: number;
    draftId: number;
    draftEvent: number;
    codeByElement: ReadonlyMap<number, ElementCode>;
  },
): NewDraftPickRow[] {
  return choices.flatMap((choice) => {
    const row = toDraftPickRow(choice, {
      leagueId: context.leagueId,
      draftId: context.draftId,
      draftEvent: context.draftEvent,
      elementCode: context.codeByElement.get(choice.element) ?? null,
    });

    return row === null ? [] : [row];
  });
}

/**
 * One element-status row plus its resolved owner to an ownership snapshot
 * fact.
 *
 * An unowned element snapshots with both owner columns null — a free agent
 * is a fact, not a gap. An owned element keeps its season-scoped `entry_id`
 * as `ownerEntry` whatever the entries list says; only the resolved
 * `ownerLeagueEntry` may be null, when the entry appears in no entry list.
 * `element-status` reflects the present, so the caller snapshots only newly
 * finalised gameweeks — re-reading present ownership against an old gameweek
 * would misattribute, and no mapping helper can guard against being called
 * with the wrong week.
 */
export function toOwnershipSnapshotRow(
  status: ElementStatus,
  context: OwnershipSnapshotContext,
): NewOwnershipSnapshotRow | null {
  if (context.elementCode == null) return null;

  return {
    leagueId: context.leagueId,
    gameweek: context.gameweek,
    elementCode: context.elementCode,
    elementId: status.element,
    ownerEntry: status.owner,
    ownerLeagueEntry:
      status.owner === null ? null : (context.ownerLeagueEntry ?? null),
  };
}

/**
 * An element-status payload to its snapshot rows for one gameweek.
 *
 * Owner resolution is a lookup against the same run's league entries, passed
 * in — this module never fetches. A free agent resolves to null without
 * touching the map; an owner absent from the map keeps its `entry_id` with a
 * null league entry rather than dropping the row.
 */
export function toOwnershipSnapshotRows(
  statuses: readonly ElementStatus[],
  context: {
    leagueId: number;
    gameweek: number;
    codeByElement: ReadonlyMap<number, ElementCode>;
    leagueEntryByEntry: ReadonlyMap<number, LeagueEntryId>;
  },
): NewOwnershipSnapshotRow[] {
  return statuses.flatMap((status) => {
    const row = toOwnershipSnapshotRow(status, {
      leagueId: context.leagueId,
      gameweek: context.gameweek,
      elementCode: context.codeByElement.get(status.element) ?? null,
      ownerLeagueEntry:
        status.owner === null
          ? null
          : (context.leagueEntryByEntry.get(status.owner) ?? null),
    });

    return row === null ? [] : [row];
  });
}
