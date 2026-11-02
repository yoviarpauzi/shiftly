CREATE TABLE "worker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text NOT NULL,
	"name" text NOT NULL,
	"site_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "worker_position" (
	"worker_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	CONSTRAINT "worker_position_worker_id_position_id_pk" PRIMARY KEY("worker_id","position_id")
);
--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_position" ADD CONSTRAINT "worker_position_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_position" ADD CONSTRAINT "worker_position_position_id_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."position"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "worker_lowerEmployeeId_active_unique" ON "worker" USING btree (lower("employee_id")) WHERE "worker"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "worker_siteId_idx" ON "worker" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "worker_locationId_idx" ON "worker" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "worker_position_positionId_idx" ON "worker_position" USING btree ("position_id");