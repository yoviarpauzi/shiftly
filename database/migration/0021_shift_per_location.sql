-- Shifts move from a site to a location. Every old shift is copied once per location of its site
-- (deleted locations included), every reference is repointed to the copy for the owning request's
-- location, and the old rows are deleted.
-- A location can be moved to another site, so a reference made before the move uses a shift of the
-- location's old site. Each such (shift, location) pair also gets a copy, soft-deleted so it keeps
-- the history but is never offered again.
ALTER TABLE "shift" ADD COLUMN "location_id" uuid;--> statement-breakpoint
-- The copies of one shift share site_id, order and name, so the old indexes must go before the copy.
DROP INDEX "shift_siteId_order_active_unique";--> statement-breakpoint
DROP INDEX "shift_siteId_lowerName_active_unique";--> statement-breakpoint
-- One row per (old shift, location): each location of the shift's own site, plus each location whose
-- request references the shift from another site (the location was moved; "moved" marks those).
CREATE TEMP TABLE "shift_map" AS
SELECT p."old_id", p."location_id", p."moved", gen_random_uuid() AS "new_id"
FROM (
  SELECT s."id" AS "old_id", l."id" AS "location_id", false AS "moved"
  FROM "shift" s
  JOIN "location" l ON l."site_id" = s."site_id"
  UNION ALL
  SELECT ref."old_id", ref."location_id", true
  FROM (
    SELECT t."shift_id" AS "old_id", rr."location_id" FROM "roster_request_line" t
    JOIN "roster_request" rr ON rr."id" = t."request_id"
    UNION
    SELECT t."shift_id", rr."location_id" FROM "roster_shift_target" t
    JOIN "roster" r ON r."id" = t."roster_id" JOIN "roster_request" rr ON rr."id" = r."request_id"
    UNION
    SELECT t."shift_id", rr."location_id" FROM "roster_assignment" t
    JOIN "roster" r ON r."id" = t."roster_id" JOIN "roster_request" rr ON rr."id" = r."request_id"
    UNION
    SELECT t."shift_id", rr."location_id" FROM "roster_conflict" t
    JOIN "roster" r ON r."id" = t."roster_id" JOIN "roster_request" rr ON rr."id" = r."request_id"
    UNION
    SELECT t."before_shift_id", rr."location_id" FROM "roster_cell_edit" t
    JOIN "roster" r ON r."id" = t."roster_id" JOIN "roster_request" rr ON rr."id" = r."request_id"
    UNION
    SELECT t."after_shift_id", rr."location_id" FROM "roster_cell_edit" t
    JOIN "roster" r ON r."id" = t."roster_id" JOIN "roster_request" rr ON rr."id" = r."request_id"
  ) ref
  JOIN "shift" s ON s."id" = ref."old_id"
  JOIN "location" l ON l."id" = ref."location_id"
  -- Pairs of the shift's own site are already in the first branch.
  WHERE l."site_id" <> s."site_id"
) p;--> statement-breakpoint
-- A copy for a moved location is soft-deleted: it is history, and active copies of the location's new
-- site may already use its order and name.
INSERT INTO "shift" ("id", "site_id", "location_id", "order", "name", "start_time", "end_time", "created_at", "updated_at", "deleted_at")
SELECT m."new_id", s."site_id", m."location_id", s."order", s."name", s."start_time", s."end_time", s."created_at", s."updated_at",
  CASE WHEN m."moved" THEN coalesce(s."deleted_at", l."deleted_at", now()) ELSE coalesce(s."deleted_at", l."deleted_at") END
FROM "shift_map" m
JOIN "shift" s ON s."id" = m."old_id"
JOIN "location" l ON l."id" = m."location_id";--> statement-breakpoint
UPDATE "roster_request_line" t SET "shift_id" = m."new_id"
FROM "shift_map" m, "roster_request" rr
WHERE t."request_id" = rr."id" AND m."old_id" = t."shift_id" AND m."location_id" = rr."location_id";--> statement-breakpoint
UPDATE "roster_shift_target" t SET "shift_id" = m."new_id"
FROM "shift_map" m, "roster" r, "roster_request" rr
WHERE t."roster_id" = r."id" AND r."request_id" = rr."id" AND m."old_id" = t."shift_id" AND m."location_id" = rr."location_id";--> statement-breakpoint
UPDATE "roster_assignment" t SET "shift_id" = m."new_id"
FROM "shift_map" m, "roster" r, "roster_request" rr
WHERE t."roster_id" = r."id" AND r."request_id" = rr."id" AND m."old_id" = t."shift_id" AND m."location_id" = rr."location_id";--> statement-breakpoint
UPDATE "roster_conflict" t SET "shift_id" = m."new_id"
FROM "shift_map" m, "roster" r, "roster_request" rr
WHERE t."roster_id" = r."id" AND r."request_id" = rr."id" AND m."old_id" = t."shift_id" AND m."location_id" = rr."location_id";--> statement-breakpoint
UPDATE "roster_cell_edit" t SET "before_shift_id" = m."new_id"
FROM "shift_map" m, "roster" r, "roster_request" rr
WHERE t."roster_id" = r."id" AND r."request_id" = rr."id" AND m."old_id" = t."before_shift_id" AND m."location_id" = rr."location_id";--> statement-breakpoint
UPDATE "roster_cell_edit" t SET "after_shift_id" = m."new_id"
FROM "shift_map" m, "roster" r, "roster_request" rr
WHERE t."roster_id" = r."id" AND r."request_id" = rr."id" AND m."old_id" = t."after_shift_id" AND m."location_id" = rr."location_id";--> statement-breakpoint
-- A reference still on an old shift could not be mapped (no copy exists for its request's location).
-- Stop rather than lose it.
DO $$
DECLARE
  remaining bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM "roster_request_line" t JOIN "shift" s ON s."id" = t."shift_id" WHERE s."location_id" IS NULL)
    + (SELECT count(*) FROM "roster_shift_target" t JOIN "shift" s ON s."id" = t."shift_id" WHERE s."location_id" IS NULL)
    + (SELECT count(*) FROM "roster_assignment" t JOIN "shift" s ON s."id" = t."shift_id" WHERE s."location_id" IS NULL)
    + (SELECT count(*) FROM "roster_conflict" t JOIN "shift" s ON s."id" = t."shift_id" WHERE s."location_id" IS NULL)
    + (SELECT count(*) FROM "roster_cell_edit" t JOIN "shift" s ON s."id" = t."before_shift_id" WHERE s."location_id" IS NULL)
    + (SELECT count(*) FROM "roster_cell_edit" t JOIN "shift" s ON s."id" = t."after_shift_id" WHERE s."location_id" IS NULL)
  INTO remaining;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'shift_per_location: % shift references could not be mapped to a location', remaining;
  END IF;
END
$$;--> statement-breakpoint
-- Old shifts, including those of a site with no location (nothing could reference them past the check).
DELETE FROM "shift" WHERE "location_id" IS NULL;--> statement-breakpoint
DROP TABLE "shift_map";--> statement-breakpoint
ALTER TABLE "shift" ALTER COLUMN "location_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shift" DROP CONSTRAINT "shift_site_id_site_id_fk";--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" DROP COLUMN "site_id";--> statement-breakpoint
CREATE UNIQUE INDEX "shift_locationId_order_active_unique" ON "shift" USING btree ("location_id","order") WHERE "shift"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "shift_locationId_lowerName_active_unique" ON "shift" USING btree ("location_id",lower("name")) WHERE "shift"."deleted_at" is null;
