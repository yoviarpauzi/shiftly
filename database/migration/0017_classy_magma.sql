CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_assignment_id" uuid NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"marked_by" text,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_roster_assignment_id_unique" UNIQUE("roster_assignment_id"),
	CONSTRAINT "attendance_status_check" CHECK ("attendance"."status" in ('present', 'absent', 'sick', 'leave')),
	CONSTRAINT "attendance_reason_check" CHECK ("attendance"."reason" is null or char_length("attendance"."reason") <= 200)
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_roster_assignment_id_roster_assignment_id_fk" FOREIGN KEY ("roster_assignment_id") REFERENCES "public"."roster_assignment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_user_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;