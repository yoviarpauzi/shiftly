CREATE TABLE "po_counter" (
	"site_id" uuid NOT NULL,
	"period" text NOT NULL,
	"last_value" integer NOT NULL,
	CONSTRAINT "po_counter_site_id_period_pk" PRIMARY KEY("site_id","period")
);
--> statement-breakpoint
CREATE TABLE "roster_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_number" text NOT NULL,
	"type" text NOT NULL,
	"start_date" date NOT NULL,
	"site_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"reject_reason" text,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_request_po_number_unique" UNIQUE("po_number"),
	CONSTRAINT "roster_request_type_check" CHECK ("roster_request"."type" in ('daily', 'weekly')),
	CONSTRAINT "roster_request_status_check" CHECK ("roster_request"."status" in ('pending', 'approved', 'rejected', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "roster_request_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"sub_department_id" uuid,
	"position_id" uuid NOT NULL,
	"headcount" integer NOT NULL,
	CONSTRAINT "roster_request_line_headcount_check" CHECK ("roster_request_line"."headcount" between 1 and 999)
);
--> statement-breakpoint
ALTER TABLE "po_counter" ADD CONSTRAINT "po_counter_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request" ADD CONSTRAINT "roster_request_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request" ADD CONSTRAINT "roster_request_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request" ADD CONSTRAINT "roster_request_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request" ADD CONSTRAINT "roster_request_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request" ADD CONSTRAINT "roster_request_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request_line" ADD CONSTRAINT "roster_request_line_request_id_roster_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."roster_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request_line" ADD CONSTRAINT "roster_request_line_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request_line" ADD CONSTRAINT "roster_request_line_sub_department_id_sub_department_id_fk" FOREIGN KEY ("sub_department_id") REFERENCES "public"."sub_department"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request_line" ADD CONSTRAINT "roster_request_line_position_id_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."position"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roster_request_siteId_idx" ON "roster_request" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "roster_request_locationId_idx" ON "roster_request" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "roster_request_status_startDate_idx" ON "roster_request" USING btree ("status","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_request_line_unique" ON "roster_request_line" USING btree ("request_id","department_id",coalesce("sub_department_id", '00000000-0000-0000-0000-000000000000'::uuid),"position_id");--> statement-breakpoint
CREATE INDEX "roster_request_line_requestId_idx" ON "roster_request_line" USING btree ("request_id");