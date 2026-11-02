ALTER TABLE "worker" ADD COLUMN "end_contract" date;
--> statement-breakpoint
UPDATE "worker" SET "end_contract" = '2026-12-31' WHERE "end_contract" IS NULL;
--> statement-breakpoint
ALTER TABLE "worker" ALTER COLUMN "end_contract" SET NOT NULL;
