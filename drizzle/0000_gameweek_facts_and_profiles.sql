CREATE TABLE "gameweek_scores" (
	"gameweek" integer NOT NULL,
	"league_entry" integer NOT NULL,
	"points" integer NOT NULL,
	"rank" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gameweek_scores_gameweek_league_entry_pk" PRIMARY KEY("gameweek","league_entry")
);
--> statement-breakpoint
CREATE TABLE "gameweeks" (
	"gameweek" integer PRIMARY KEY NOT NULL,
	"finalised_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"league_entry" integer NOT NULL,
	"display_name" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_league_entry_unique" UNIQUE("league_entry")
);
