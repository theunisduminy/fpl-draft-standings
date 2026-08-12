CREATE TABLE "league_members" (
	"email" text PRIMARY KEY NOT NULL,
	"league_entry" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_members_league_entry_unique" UNIQUE("league_entry")
);
--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_league_entry_unique";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "league_entry";