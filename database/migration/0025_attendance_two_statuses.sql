UPDATE "attendance" SET "status" = 'absent' WHERE "status" IN ('sick', 'leave');--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_status_check";--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_status_check" CHECK ("attendance"."status" in ('present', 'absent'));
