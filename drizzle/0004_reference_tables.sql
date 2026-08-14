CREATE TABLE "draft_elements" (
	"league_id" integer NOT NULL,
	"element_id" integer NOT NULL,
	"code" integer NOT NULL,
	"web_name" text NOT NULL,
	"position" text NOT NULL,
	"team_code" integer NOT NULL,
	"total_points" integer NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_elements_league_id_element_id_pk" PRIMARY KEY("league_id","element_id")
);
--> statement-breakpoint
CREATE TABLE "pl_teams" (
	"league_id" integer NOT NULL,
	"code" integer NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pl_teams_league_id_code_pk" PRIMARY KEY("league_id","code")
);
