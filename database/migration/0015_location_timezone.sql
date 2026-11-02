ALTER TABLE "location" ADD COLUMN "timezone" text DEFAULT 'Asia/Jakarta' NOT NULL;
--> statement-breakpoint
ALTER TABLE "location" ALTER COLUMN "timezone" DROP DEFAULT;
