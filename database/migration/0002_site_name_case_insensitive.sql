DROP INDEX "site_name_active_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "site_name_lower_active_unique" ON "site" USING btree (lower("name")) WHERE "site"."deleted_at" is null;