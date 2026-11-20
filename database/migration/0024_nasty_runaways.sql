-- Single site. Hand-written data steps run first, then the generated DDL. Drizzle runs the file in
-- one transaction, so any exception below leaves the database unchanged.
-- "Removed site" means every site except the one active site named Nestle.

-- 1. Guard: one active site named Nestle, and at most one other active site.
DO $$
DECLARE
  nestle_count integer;
  other_count integer;
BEGIN
  SELECT count(*) INTO nestle_count FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL;
  SELECT count(*) INTO other_count FROM "site" WHERE "name" <> 'Nestle' AND "deleted_at" IS NULL;
  IF nestle_count <> 1 OR other_count > 1 THEN
    RAISE EXCEPTION 'single-site migration aborted: expected one active site named Nestle and at most one other active site, found % Nestle and % other', nestle_count, other_count;
  END IF;
END $$;--> statement-breakpoint

-- 2. Remove the other site. The request tree is hard-deleted in foreign-key order: attendance
-- (restrict to roster_assignment), then roster (assignments, cell edits, conflicts, edits and shift
-- targets cascade), then roster_request (lines and line days cascade).
DELETE FROM "attendance" WHERE "roster_assignment_id" IN (
  SELECT ra."id" FROM "roster_assignment" ra
  JOIN "roster" r ON r."id" = ra."roster_id"
  JOIN "roster_request" rr ON rr."id" = r."request_id"
  WHERE rr."site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL)
);--> statement-breakpoint
DELETE FROM "roster" WHERE "request_id" IN (
  SELECT "id" FROM "roster_request"
  WHERE "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL)
);--> statement-breakpoint
DELETE FROM "roster_request"
  WHERE "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL);--> statement-breakpoint
DELETE FROM "po_counter"
  WHERE "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL);--> statement-breakpoint
DELETE FROM "work_rule"
  WHERE "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL)
  OR "location_id" IN (
    SELECT "id" FROM "location"
    WHERE "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL)
  );--> statement-breakpoint
UPDATE "shift" SET "deleted_at" = now()
  WHERE "deleted_at" IS NULL AND "location_id" IN (
    SELECT "id" FROM "location"
    WHERE "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL)
  );--> statement-breakpoint
UPDATE "sub_department" SET "deleted_at" = now()
  WHERE "deleted_at" IS NULL AND "department_id" IN (
    SELECT d."id" FROM "department" d JOIN "location" l ON l."id" = d."location_id"
    WHERE l."site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL)
  );--> statement-breakpoint
UPDATE "department" SET "deleted_at" = now()
  WHERE "deleted_at" IS NULL AND "location_id" IN (
    SELECT "id" FROM "location"
    WHERE "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL)
  );--> statement-breakpoint
UPDATE "worker" SET "deleted_at" = now()
  WHERE "deleted_at" IS NULL
  AND "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL);--> statement-breakpoint
UPDATE "position" SET "deleted_at" = now()
  WHERE "deleted_at" IS NULL
  AND "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL);--> statement-breakpoint
UPDATE "user" SET "banned" = true, "ban_reason" = 'Site removed'
  WHERE "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL)
  OR "location_id" IN (
    SELECT "id" FROM "location"
    WHERE "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL)
  );--> statement-breakpoint
UPDATE "location" SET "deleted_at" = now()
  WHERE "deleted_at" IS NULL
  AND "site_id" <> (SELECT "id" FROM "site" WHERE "name" = 'Nestle' AND "deleted_at" IS NULL);--> statement-breakpoint

-- 3. Roles: superadmin becomes ho.
UPDATE "user" SET "role" = 'ho' WHERE "role" = 'superadmin';--> statement-breakpoint

-- 4. Work rules: Nestle has no site-scope row, so stop if one appeared, then remove any left.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "work_rule" WHERE "scope" = 'site') THEN
    RAISE EXCEPTION 'single-site migration aborted: a site-scope work rule exists; move it to the global row by hand first';
  END IF;
END $$;--> statement-breakpoint
DELETE FROM "work_rule" WHERE "scope" = 'site';--> statement-breakpoint

-- 5. PO counter: one row per period, keeping the highest last_value.
DELETE FROM "po_counter" p USING "po_counter" q
  WHERE p."period" = q."period"
  AND (q."last_value" > p."last_value" OR (q."last_value" = p."last_value" AND q."site_id" > p."site_id"));--> statement-breakpoint

-- 6. Collision check for the new name indexes among active rows. It fails, it does not merge.
DO $$
DECLARE
  location_names text;
  position_names text;
BEGIN
  SELECT string_agg(names, '; ') INTO location_names FROM (
    SELECT string_agg("name", ', ' ORDER BY "name") AS names FROM "location"
    WHERE "deleted_at" IS NULL GROUP BY lower("name") HAVING count(*) > 1
  ) c;
  SELECT string_agg(names, '; ') INTO position_names FROM (
    SELECT string_agg("name", ', ' ORDER BY "name") AS names FROM "position"
    WHERE "deleted_at" IS NULL GROUP BY lower("name") HAVING count(*) > 1
  ) c;
  IF location_names IS NOT NULL OR position_names IS NOT NULL THEN
    RAISE EXCEPTION 'single-site migration aborted: active name collisions. Locations: %. Positions: %.',
      coalesce(location_names, 'none'), coalesce(position_names, 'none');
  END IF;
END $$;--> statement-breakpoint

-- Generated DDL. The site table is dropped last, after every column that references it.
ALTER TABLE "work_rule" DROP CONSTRAINT "work_rule_scope_check";--> statement-breakpoint
ALTER TABLE "work_rule" DROP CONSTRAINT "work_rule_target_check";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_site_id_site_id_fk";
--> statement-breakpoint
ALTER TABLE "location" DROP CONSTRAINT "location_site_id_site_id_fk";
--> statement-breakpoint
ALTER TABLE "position" DROP CONSTRAINT "position_site_id_site_id_fk";
--> statement-breakpoint
ALTER TABLE "po_counter" DROP CONSTRAINT "po_counter_site_id_site_id_fk";
--> statement-breakpoint
ALTER TABLE "roster_request" DROP CONSTRAINT "roster_request_site_id_site_id_fk";
--> statement-breakpoint
ALTER TABLE "work_rule" DROP CONSTRAINT "work_rule_site_id_site_id_fk";
--> statement-breakpoint
ALTER TABLE "worker" DROP CONSTRAINT "worker_site_id_site_id_fk";
--> statement-breakpoint
DROP INDEX "location_siteId_lowerName_active_unique";--> statement-breakpoint
DROP INDEX "position_siteId_lowerName_active_unique";--> statement-breakpoint
DROP INDEX "roster_request_siteId_idx";--> statement-breakpoint
DROP INDEX "work_rule_site_unique";--> statement-breakpoint
DROP INDEX "worker_siteId_idx";--> statement-breakpoint
ALTER TABLE "po_counter" DROP CONSTRAINT "po_counter_site_id_period_pk";--> statement-breakpoint
ALTER TABLE "po_counter" ADD PRIMARY KEY ("period");--> statement-breakpoint
CREATE UNIQUE INDEX "location_lowerName_active_unique" ON "location" USING btree (lower("name")) WHERE "location"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "position_lowerName_active_unique" ON "position" USING btree (lower("name")) WHERE "position"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "location" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "position" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "po_counter" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "roster_request" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "work_rule" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "worker" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "work_rule" ADD CONSTRAINT "work_rule_scope_check" CHECK ("work_rule"."scope" in ('global', 'location'));--> statement-breakpoint
ALTER TABLE "work_rule" ADD CONSTRAINT "work_rule_target_check" CHECK (("work_rule"."scope" = 'global' and "work_rule"."location_id" is null)
        or ("work_rule"."scope" = 'location' and "work_rule"."location_id" is not null));--> statement-breakpoint
DROP TABLE "site";
