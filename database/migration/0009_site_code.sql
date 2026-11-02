ALTER TABLE "site" ADD COLUMN "code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "site_code_lower_active_unique" ON "site" USING btree (lower("code")) WHERE "site"."deleted_at" is null;