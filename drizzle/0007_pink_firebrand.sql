CREATE TABLE "draft_picks" (
	"league_id" integer NOT NULL,
	"draft_id" integer NOT NULL,
	"draft_index" integer NOT NULL,
	"draft_event" integer NOT NULL,
	"round" integer NOT NULL,
	"pick" integer NOT NULL,
	"entry" integer NOT NULL,
	"element_id" integer NOT NULL,
	"element_code" integer NOT NULL,
	"was_auto" boolean NOT NULL,
	"seconds_to_pick" integer,
	CONSTRAINT "draft_picks_league_id_draft_id_draft_index_pk" PRIMARY KEY("league_id","draft_id","draft_index")
);
--> statement-breakpoint
CREATE TABLE "ownership_snapshots" (
	"league_id" integer NOT NULL,
	"gameweek" integer NOT NULL,
	"element_code" integer NOT NULL,
	"element_id" integer NOT NULL,
	"owner_entry" integer,
	"owner_league_entry" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ownership_snapshots_league_id_gameweek_element_code_pk" PRIMARY KEY("league_id","gameweek","element_code")
);
