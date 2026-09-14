CREATE TABLE "finalisation_candidates" (
	"league_id" integer NOT NULL,
	"gameweek" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked" timestamp with time zone DEFAULT now() NOT NULL,
	"block_reason" text,
	CONSTRAINT "finalisation_candidates_league_id_gameweek_pk" PRIMARY KEY("league_id","gameweek")
);
