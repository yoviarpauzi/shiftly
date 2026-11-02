CREATE TABLE "shift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shift_siteId_number_active_unique" ON "shift" USING btree ("site_id","number") WHERE "shift"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "shift_siteId_lowerName_active_unique" ON "shift" USING btree ("site_id",lower("name")) WHERE "shift"."deleted_at" is null;