-- Scope the persisted tables by league.
--
-- A league id is effectively a season id: a renewed league gets a new id, and
-- its `league_entries[].id` / `entry_id` values are minted fresh alongside it.
-- Without this column, next season's gameweek 1 collides with this season's,
-- and a member mapping survives pointing at a number that may now belong to
-- somebody else.
--
-- Hand-written: drizzle-kit could not resolve the existing primary-key names
-- and emitted ADD CONSTRAINT before ADD COLUMN. All four tables are empty, so
-- the NOT NULL columns need no backfill.

-- Columns first, so the new keys have something to reference.
ALTER TABLE "gameweek_scores" ADD COLUMN "league_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "gameweeks" ADD COLUMN "league_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "league_members" ADD COLUMN "league_id" integer NOT NULL;--> statement-breakpoint

-- Then swap the keys.
ALTER TABLE "gameweek_scores" DROP CONSTRAINT "gameweek_scores_gameweek_league_entry_pk";--> statement-breakpoint
ALTER TABLE "gameweeks" DROP CONSTRAINT "gameweeks_pkey";--> statement-breakpoint
ALTER TABLE "league_members" DROP CONSTRAINT "league_members_pkey";--> statement-breakpoint
ALTER TABLE "league_members" DROP CONSTRAINT "league_members_league_entry_unique";--> statement-breakpoint

ALTER TABLE "gameweek_scores" ADD CONSTRAINT "gameweek_scores_league_id_gameweek_league_entry_pk" PRIMARY KEY("league_id","gameweek","league_entry");--> statement-breakpoint
ALTER TABLE "gameweeks" ADD CONSTRAINT "gameweeks_league_id_gameweek_pk" PRIMARY KEY("league_id","gameweek");--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_email_pk" PRIMARY KEY("league_id","email");--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_league_entry_unique" UNIQUE("league_id","league_entry");
