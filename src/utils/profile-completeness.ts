/**
 * What makes a profile finished.
 *
 * **One rule, two enforcers.** The onboarding gate asks it of a stored row
 * (`getCurrentUser` → `(onboarded)/layout.tsx`), and `updateProfile` asks it of
 * what a caller just submitted. Those two live either side of the database and
 * used to state the rule separately, which is a gate that can drift open: let
 * the write accept something the gate calls incomplete and a member is sent
 * back to `/profile` from every page, forever, by a form that keeps saying it
 * saved. Stated here, in a pure module, they cannot disagree — and it can be
 * tested, which neither `server-only` module can.
 *
 * Both fields, neither blank. Whitespace does not count as a display name, so
 * the check trims: otherwise a single space would satisfy the gate and the
 * compulsory part of compulsory onboarding would be one keystroke deep.
 *
 * The favourite club is the second because a profile without one says nothing
 * about the person, and picking it is one tap from a list of twenty. The
 * standings board deliberately does *not* show it — a table of finishing
 * positions is not the place for allegiance — so the requirement stands on the
 * profile alone.
 *
 * There was a third, a free-text bio. It was dropped: it was a field people
 * filled in once with a placeholder and never read, and every extra compulsory
 * box is another reason to bounce off the one screen standing between a member
 * and the league.
 *
 * The column stays **nullable**. Completeness is decided here rather than by
 * the database: a `NOT NULL` migration would have to invent a club for every
 * member who signed up before this rule, and there is no right answer to
 * invent. Those rows read as incomplete and their owners pick a club once.
 */
export interface ProfileFields {
  displayName: string | null;
  favouriteTeam: number | null;
}

export function isProfileComplete(profile: ProfileFields | null): boolean {
  return Boolean(profile?.displayName?.trim() && profile?.favouriteTeam);
}
