CREATE TABLE "roster_request_line_day" (
	"line_id" uuid NOT NULL,
	"day_offset" smallint NOT NULL,
	"headcount" integer NOT NULL,
	CONSTRAINT "roster_request_line_day_line_id_day_offset_pk" PRIMARY KEY("line_id","day_offset"),
	CONSTRAINT "roster_request_line_day_offset_check" CHECK ("roster_request_line_day"."day_offset" between 0 and 6),
	CONSTRAINT "roster_request_line_day_headcount_check" CHECK ("roster_request_line_day"."headcount" between 0 and 999)
);
--> statement-breakpoint
ALTER TABLE "roster_request_line_day" ADD CONSTRAINT "roster_request_line_day_line_id_roster_request_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."roster_request_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "roster_request_line_day" ("line_id", "day_offset", "headcount")
SELECT l."id", d.n, l."headcount"
FROM "roster_request_line" l
JOIN "roster_request" r ON r."id" = l."request_id"
CROSS JOIN LATERAL generate_series(0, CASE WHEN r."type" = 'weekly' THEN 6 ELSE 0 END) AS d(n);--> statement-breakpoint
ALTER TABLE "roster_request_line" DROP CONSTRAINT "roster_request_line_headcount_check";--> statement-breakpoint
ALTER TABLE "roster_request_line" ALTER COLUMN "headcount" DROP NOT NULL;
