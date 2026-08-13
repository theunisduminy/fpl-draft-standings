# Seeding the league roster

`league_members` maps an email address to the manager it belongs to. It is the single
source of truth for both **who may sign in** and **which manager they are**, so nothing is
self-service — there is no claim flow to game.

```bash
cp league-members.example.json league-members.json   # gitignored: real addresses
# fill in the "email" fields
pnpm db:seed:members
```

The seed validates the whole roster before writing anything, lowercases addresses, and
upserts, so re-running is safe. Leave an `email` blank for anyone who has not joined —
just delete that entry from the file.

## This has to be redone every August

**Both FPL identifiers are season-scoped.** A renewed league is issued a new id, and its
`league_entries[].id` and `entry_id` values are minted fresh alongside it — all eight of
ours were created in one sequential block on the day the league formed. Last season's
league ids now return 404.

So the `leagueEntry` numbers above are only valid for league `8337`. Each new season:

1. Update `FPL_LEAGUE_ID` in `.env.local` (and Vercel).
2. Get the new entry ids:
   ```bash
   curl -s "https://draft.premierleague.com/api/league/$FPL_LEAGUE_ID/details" \
     | jq -r '.league_entries[] | "\(.id)\t\(.player_first_name) \(.player_last_name)\t\(.entry_name)"'
   ```
3. Update `league-members.json` with the new ids and run `pnpm db:seed:members`.

Rows are keyed by `(league_id, email)`, so last season's mapping stays put and is simply
ignored rather than being wrong. The **email** is the stable identity across seasons; the
entry id is not. Profiles are keyed on the Neon Auth user id and are season-independent, so
display names and bios survive the rollover untouched.

Team names change too (`Frankly Speaking` became `DeZerbi To Win` mid-pre-season), so never
key on those either.
