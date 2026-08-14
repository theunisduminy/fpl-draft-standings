import {
  POSITION_ORDER,
  asElementCode,
  asTeamCode,
  type DraftBootstrap,
  type ElementCode,
  type ElementId,
  type PlTeam,
  type Position,
  type TeamCode,
} from '@/interfaces/fpl';
import type {
  DraftElementRow,
  NewDraftElementRow,
  NewPlTeamRow,
  PlTeamRow,
} from '@/server/db/schema';

/**
 * The pure half of the reference cache: payload in, rows out, and the one
 * question a reader has to answer before trusting a table.
 *
 * **No database and no fetch in this file**, deliberately. It is the same split
 * that made the scoring layer testable — a rule wrapped inside an `async`
 * function around 850 KB of download and a Neon round trip cannot be pinned by
 * a test, and every rule here fails silently when broken: a table that reads as
 * complete while missing a player, a club column of em dashes, a row dated by a
 * sync that only re-wrote a six-hour-old payload.
 *
 * The DAL moves these rows; this module gives them meaning.
 */

/**
 * How old reference data may be before a reader stops trusting it.
 *
 * **One value, cited in two places**: the fallback decision below, and the cron
 * schedule in `vercel.json`. They cannot drift apart while both point here.
 *
 * Six hours is not arbitrary — it is what the read path already assumed. The
 * bootstrap fetch it replaces was held for exactly this long, so a table inside
 * the budget is never staler than the payload used to be.
 *
 * **The cron runs every three hours, deliberately half of this.** A budget
 * equal to the interval would put every row at the edge of expiry just before
 * each sync, so any late or failed run would tip the whole app into fallback.
 * At double, one missed run costs nothing and two are needed before a reader
 * notices. Shortening the budget below the interval would invert that: every
 * read would fall back, which is the old behaviour plus a wasted query.
 */
export const REFERENCE_STALE_AFTER_SECONDS = 21_600;

/**
 * When a set of rows last synced: the **newest** stamp in it.
 *
 * Pure, shared by both DAL modules, and tested — because getting it wrong is
 * silent and total. It was briefly the *oldest* stamp, on the theory that a
 * staleness check is only as good as its weakest row. But the upsert is a
 * single atomic `INSERT … ON CONFLICT`, so the partial write that would have
 * guarded against cannot happen, while `upsertElements` deliberately never
 * prunes — so one row whose element stops appearing in the bootstrap keeps its
 * old stamp forever and pins the whole table `stale` for the rest of the
 * season, sending every read back to the 850 KB bootstrap while the sync job
 * goes on reporting success.
 *
 * Rows that were never written are caught by the completeness check instead,
 * against the ids a caller actually asked for.
 */
export function latestSync(rows: readonly { syncedAt: Date }[]): Date | null {
  if (rows.length === 0) return null;

  return rows.reduce(
    (newest, row) => (row.syncedAt > newest ? row.syncedAt : newest),
    rows[0].syncedAt,
  );
}

/** The Premier League is twenty clubs. It has been since 1995. */
export const PREMIER_LEAGUE_CLUBS = 20;

/**
 * May this club payload be trusted to *prune* with, not merely to write?
 *
 * Upserting from a short payload is harmless — the rows it does carry are
 * correct. Pruning from one is not: `isKnownTeamCode` reads that table as an
 * allowlist on behalf of `updateProfile`, a public POST endpoint, so deleting
 * every club the payload happens to omit can make real clubs unacceptable
 * input. A half-delivered response would quietly narrow the dropdown to
 * whatever survived.
 *
 * Refusing to prune trades back only the lesser failure R10a already accepts:
 * a relegated club stays acceptable until a full payload arrives. Lives here,
 * in the pure layer, because it is a rule — and because the emptiness check it
 * replaces sat in the untested DAL, where deleting it passed every test.
 */
export function isCompleteClubPayload(rows: readonly unknown[]): boolean {
  return rows.length >= PREMIER_LEAGUE_CLUBS;
}

/**
 * Which of the requested elements this lookup cannot name.
 *
 * The completeness rule, extracted so the path that actually runs is the path
 * under test. It briefly lived as an optional argument to `isReferenceUsable`,
 * which no caller ever passed once `ensureCovers` took the job — four tests
 * pinning a branch production never reached, while the real rule ran untested
 * inside an impure function. The repo's testing law is explicit that a rule
 * worth having is a rule worth pinning; this is where it can be.
 */
export function missingElements(
  isKnown: (element: ElementId) => boolean,
  requested: readonly ElementId[],
): ElementId[] {
  return requested.filter((element) => !isKnown(element));
}

/** Why a table could not answer, in the reader's words. */
export type ReferenceUnusable =
  /** No rows at all — never synced, or a different league. */
  | 'empty'
  /** Older than the budget, or of unknown age. */
  | 'stale';

export type ReferenceVerdict =
  | { usable: true }
  | { usable: false; reason: ReferenceUnusable; detail?: string };

/**
 * May these rows be used instead of the bootstrap?
 *
 * Two ways to say no, and the caller logs which one — a fallback has to be
 * silent to the reader and visible to the operator, or a sync can fail for
 * weeks while the pages quietly keep paying full price.
 *
 * Deliberately **not** completeness: this answers "may these rows be trusted?",
 * which is a property of the table alone. Whether they cover what a particular
 * caller needs is `missingElements`, asked later by whoever knows the answer.
 */
export function isReferenceUsable<T extends object>(
  rows: readonly T[],
  syncedAt: Date | null,
  now: Date,
): ReferenceVerdict {
  // Checked before staleness: an empty table is never merely old, and the
  // operator reading the log wants "never populated", not "expired".
  if (rows.length === 0) return { usable: false, reason: 'empty' };

  if (syncedAt === null) {
    return {
      usable: false,
      reason: 'stale',
      detail: 'rows carry no synced_at',
    };
  }

  const ageSeconds = (now.getTime() - syncedAt.getTime()) / 1000;

  // Inclusive at the boundary: a cron firing exactly on the budget must not
  // race a reader into a fallback it does not need.
  if (ageSeconds > REFERENCE_STALE_AFTER_SECONDS) {
    return {
      usable: false,
      reason: 'stale',
      detail: `${Math.round(ageSeconds)}s old, budget ${REFERENCE_STALE_AFTER_SECONDS}s`,
    };
  }

  return { usable: true };
}

/**
 * Bootstrap elements to rows.
 *
 * An element whose club is not in the same payload is **dropped**, not stored
 * with a null club. A row that cannot answer the club column would make the
 * table read as complete while rendering an em dash, which is precisely the
 * failure the completeness check above exists to catch — so it must never be
 * written in the first place.
 */
export function toElementRows(
  bootstrap: DraftBootstrap,
  leagueId: number,
): NewDraftElementRow[] {
  const clubCodeById = new Map(
    bootstrap.teams.map((team) => [team.id, team.code]),
  );
  const positionById = new Map(
    bootstrap.element_types.map((type) => [type.id, type.singular_name_short]),
  );

  return bootstrap.elements.flatMap((element) => {
    const teamCode = clubCodeById.get(element.team);

    if (teamCode === undefined) return [];

    return [
      {
        leagueId,
        elementId: element.id,
        code: element.code,
        webName: element.web_name,
        position: toPosition(positionById.get(element.element_type)),
        teamCode,
        totalPoints: element.total_points,
      },
    ];
  });
}

/** Bootstrap clubs to rows, keyed by the season-stable code. */
export function toTeamRows(
  bootstrap: DraftBootstrap,
  leagueId: number,
): NewPlTeamRow[] {
  return bootstrap.teams.map((team) => ({
    leagueId,
    code: team.code,
    name: team.name,
    shortName: team.short_name,
  }));
}

/** What a reader needs about one footballer, whatever the source. */
export interface ElementDetails {
  name: string;
  position: Position;
  club: string;
  /** Season-stable, and what a headshot URL is built from. */
  code: ElementCode | null;
  /**
   * The club's crest identity — `teams[].code`, what the crest SVG is named
   * after. Null when the club could not be resolved, in which case `club` is
   * the em dash and there is nothing to draw.
   */
  clubCode: TeamCode | null;
  /**
   * The footballer's **season total** — everything they have scored, not what
   * they scored for whoever owns them now. A player traded in at GW10 brings
   * their first nine gameweeks with them here. A manager's own total is the F1
   * score, which is computed from gameweek results and owes nothing to this.
   *
   * **Between seasons it is the season just gone.** Upstream resets it shortly
   * before GW1, so a squad rendered in pre-season shows last year's points
   * against players who have not kicked a ball. Deliberately left alone: it is
   * upstream's number and it fixes itself on kick-off.
   */
  points: number;
}

/**
 * A stored row back to domain shape.
 *
 * The driver can only tell us these columns are integers and text, so this is
 * where they get their identity back — the same re-branding
 * `getStoredPerformances` does on the way out of `gameweek_scores`.
 */
export function toElementDetails(
  row: DraftElementRow,
  clubsByCode: Map<number, PlTeam>,
): ElementDetails {
  return {
    name: row.webName,
    position: toPosition(row.position),
    club: clubsByCode.get(row.teamCode)?.short_name ?? '—',
    clubCode: clubsByCode.get(row.teamCode)?.code ?? null,
    code: asElementCode(row.code),
    points: row.totalPoints,
  };
}

/** A stored club row back to the shape `ProfileForm` and the crests expect. */
export function toPlTeam(row: PlTeamRow): PlTeam {
  return {
    code: asTeamCode(row.code),
    name: row.name,
    short_name: row.shortName,
  };
}

/** Both upstream and the database hand us a bare string; keep it in the union. */
export function toPosition(raw: string | undefined): Position {
  return POSITION_ORDER.includes(raw as Position) ? (raw as Position) : 'UNK';
}
