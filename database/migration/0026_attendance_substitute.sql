CREATE TABLE "attendance_substitute" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_id" uuid NOT NULL,
	"substitute_worker_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_substitute_attendance_id_unique" UNIQUE("attendance_id")
);
--> statement-breakpoint
ALTER TABLE "attendance_substitute" ADD CONSTRAINT "attendance_substitute_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_substitute" ADD CONSTRAINT "attendance_substitute_substitute_worker_id_worker_id_fk" FOREIGN KEY ("substitute_worker_id") REFERENCES "public"."worker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_substitute" ADD CONSTRAINT "attendance_substitute_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_substitute_worker_date_unique" ON "attendance_substitute" USING btree ("substitute_worker_id","work_date");