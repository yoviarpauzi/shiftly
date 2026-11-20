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
	CONSTRAINT "attendance_status_check" CHECK ("attendance"."status" in ('present', 'absent')),
	CONSTRAINT "attendance_reason_check" CHECK ("attendance"."reason" is null or char_length("attendance"."reason") <= 200)
);
--> statement-breakpoint
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
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"location_id" uuid,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sub_department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "position" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "po_counter" (
	"period" text PRIMARY KEY NOT NULL,
	"last_value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_number" text NOT NULL,
	"type" text NOT NULL,
	"start_date" date NOT NULL,
	"location_id" uuid NOT NULL,
	"status" text NOT NULL,
	"reject_reason" text,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_request_po_number_unique" UNIQUE("po_number"),
	CONSTRAINT "roster_request_type_check" CHECK ("roster_request"."type" in ('daily', 'weekly')),
	CONSTRAINT "roster_request_status_check" CHECK ("roster_request"."status" in ('pending', 'approved', 'rejected', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "roster_request_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"sub_department_id" uuid,
	"position_id" uuid NOT NULL,
	"shift_id" uuid
);
--> statement-breakpoint
CREATE TABLE "roster_request_line_day" (
	"line_id" uuid NOT NULL,
	"day_offset" smallint NOT NULL,
	"headcount" integer NOT NULL,
	CONSTRAINT "roster_request_line_day_line_id_day_offset_pk" PRIMARY KEY("line_id","day_offset"),
	CONSTRAINT "roster_request_line_day_offset_check" CHECK ("roster_request_line_day"."day_offset" between 0 and 6),
	CONSTRAINT "roster_request_line_day_headcount_check" CHECK ("roster_request_line_day"."headcount" between 0 and 999)
);
--> statement-breakpoint
CREATE TABLE "roster" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"status" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" text,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "roster_status_check" CHECK ("roster"."status" in ('draft', 'confirmed')),
	CONSTRAINT "roster_confirmed_at_check" CHECK (("roster"."status" = 'confirmed') = ("roster"."confirmed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "roster_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_id" uuid NOT NULL,
	"request_line_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"kind" text NOT NULL,
	"shift_id" uuid,
	CONSTRAINT "roster_assignment_kind_check" CHECK ("roster_assignment"."kind" in ('work', 'off', 'break')),
	CONSTRAINT "roster_assignment_shift_check" CHECK (("roster_assignment"."kind" = 'work') = ("roster_assignment"."shift_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "roster_cell_edit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_id" uuid NOT NULL,
	"request_line_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"before_kind" text,
	"before_shift_id" uuid,
	"after_kind" text,
	"after_shift_id" uuid,
	"edited_by" text,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_cell_edit_before_check" CHECK (("roster_cell_edit"."before_kind" is null or "roster_cell_edit"."before_kind" in ('work', 'off', 'break')) and (coalesce("roster_cell_edit"."before_kind" = 'work', false) = ("roster_cell_edit"."before_shift_id" is not null))),
	CONSTRAINT "roster_cell_edit_after_check" CHECK (("roster_cell_edit"."after_kind" is null or "roster_cell_edit"."after_kind" in ('work', 'off', 'break')) and (coalesce("roster_cell_edit"."after_kind" = 'work', false) = ("roster_cell_edit"."after_shift_id" is not null)))
);
--> statement-breakpoint
CREATE TABLE "roster_conflict" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_id" uuid NOT NULL,
	"request_line_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"shift_id" uuid,
	"code" text NOT NULL,
	"shortfall" smallint NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_edit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_id" uuid NOT NULL,
	"request_line_id" uuid NOT NULL,
	"from_worker_id" uuid NOT NULL,
	"to_worker_id" uuid NOT NULL,
	"edited_by" text,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_shift_target" (
	"roster_id" uuid NOT NULL,
	"request_line_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"shift_id" uuid NOT NULL,
	"headcount" smallint NOT NULL,
	CONSTRAINT "roster_shift_target_roster_id_request_line_id_work_date_shift_id_pk" PRIMARY KEY("roster_id","request_line_id","work_date","shift_id"),
	CONSTRAINT "roster_shift_target_headcount_check" CHECK ("roster_shift_target"."headcount" between 0 and 999)
);
--> statement-breakpoint
CREATE TABLE "shift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"location_id" uuid,
	"work_days_per_week" smallint,
	"break_days" smallint,
	"break_cycle_months" smallint,
	"annual_off_days" smallint,
	"shift_exception_days" smallint,
	"require_position_match" boolean,
	"keep_previous_placement" boolean,
	"max_working_days_per_month" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "work_rule_scope_check" CHECK ("work_rule"."scope" in ('global', 'location')),
	CONSTRAINT "work_rule_target_check" CHECK (("work_rule"."scope" = 'global' and "work_rule"."location_id" is null)
        or ("work_rule"."scope" = 'location' and "work_rule"."location_id" is not null)),
	CONSTRAINT "work_rule_work_days_check" CHECK ("work_rule"."work_days_per_week" is null or "work_rule"."work_days_per_week" in (5, 7)),
	CONSTRAINT "work_rule_break_days_check" CHECK ("work_rule"."break_days" is null or "work_rule"."break_days" between 1 and 31),
	CONSTRAINT "work_rule_break_cycle_months_check" CHECK ("work_rule"."break_cycle_months" is null or "work_rule"."break_cycle_months" between 1 and 12),
	CONSTRAINT "work_rule_annual_off_days_check" CHECK ("work_rule"."annual_off_days" is null or "work_rule"."annual_off_days" between 0 and 366),
	CONSTRAINT "work_rule_shift_exception_days_check" CHECK ("work_rule"."shift_exception_days" is null or "work_rule"."shift_exception_days" between 1 and 30),
	CONSTRAINT "work_rule_max_working_days_per_month_check" CHECK ("work_rule"."max_working_days_per_month" is null or "work_rule"."max_working_days_per_month" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE "worker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text NOT NULL,
	"name" text NOT NULL,
	"location_id" uuid NOT NULL,
	"end_contract" date NOT NULL,
	"work_days_per_week" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "worker_work_days_check" CHECK ("worker"."work_days_per_week" in (5, 7))
);
--> statement-breakpoint
CREATE TABLE "worker_position" (
	"worker_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	CONSTRAINT "worker_position_worker_id_position_id_pk" PRIMARY KEY("worker_id","position_id")
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_roster_assignment_id_roster_assignment_id_fk" FOREIGN KEY ("roster_assignment_id") REFERENCES "public"."roster_assignment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_user_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_substitute" ADD CONSTRAINT "attendance_substitute_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_substitute" ADD CONSTRAINT "attendance_substitute_substitute_worker_id_worker_id_fk" FOREIGN KEY ("substitute_worker_id") REFERENCES "public"."worker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_substitute" ADD CONSTRAINT "attendance_substitute_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_department" ADD CONSTRAINT "sub_department_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request" ADD CONSTRAINT "roster_request_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request" ADD CONSTRAINT "roster_request_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request" ADD CONSTRAINT "roster_request_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request" ADD CONSTRAINT "roster_request_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request_line" ADD CONSTRAINT "roster_request_line_request_id_roster_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."roster_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request_line" ADD CONSTRAINT "roster_request_line_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request_line" ADD CONSTRAINT "roster_request_line_sub_department_id_sub_department_id_fk" FOREIGN KEY ("sub_department_id") REFERENCES "public"."sub_department"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request_line" ADD CONSTRAINT "roster_request_line_position_id_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."position"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request_line" ADD CONSTRAINT "roster_request_line_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_request_line_day" ADD CONSTRAINT "roster_request_line_day_line_id_roster_request_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."roster_request_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster" ADD CONSTRAINT "roster_request_id_roster_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."roster_request"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster" ADD CONSTRAINT "roster_generated_by_user_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster" ADD CONSTRAINT "roster_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_assignment" ADD CONSTRAINT "roster_assignment_roster_id_roster_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_assignment" ADD CONSTRAINT "roster_assignment_request_line_id_roster_request_line_id_fk" FOREIGN KEY ("request_line_id") REFERENCES "public"."roster_request_line"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_assignment" ADD CONSTRAINT "roster_assignment_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_assignment" ADD CONSTRAINT "roster_assignment_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_roster_id_roster_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_request_line_id_roster_request_line_id_fk" FOREIGN KEY ("request_line_id") REFERENCES "public"."roster_request_line"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_before_shift_id_shift_id_fk" FOREIGN KEY ("before_shift_id") REFERENCES "public"."shift"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_after_shift_id_shift_id_fk" FOREIGN KEY ("after_shift_id") REFERENCES "public"."shift"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_edited_by_user_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_conflict" ADD CONSTRAINT "roster_conflict_roster_id_roster_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_conflict" ADD CONSTRAINT "roster_conflict_request_line_id_roster_request_line_id_fk" FOREIGN KEY ("request_line_id") REFERENCES "public"."roster_request_line"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_conflict" ADD CONSTRAINT "roster_conflict_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_edit" ADD CONSTRAINT "roster_edit_roster_id_roster_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_edit" ADD CONSTRAINT "roster_edit_request_line_id_roster_request_line_id_fk" FOREIGN KEY ("request_line_id") REFERENCES "public"."roster_request_line"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_edit" ADD CONSTRAINT "roster_edit_from_worker_id_worker_id_fk" FOREIGN KEY ("from_worker_id") REFERENCES "public"."worker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_edit" ADD CONSTRAINT "roster_edit_to_worker_id_worker_id_fk" FOREIGN KEY ("to_worker_id") REFERENCES "public"."worker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_edit" ADD CONSTRAINT "roster_edit_edited_by_user_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_shift_target" ADD CONSTRAINT "roster_shift_target_roster_id_roster_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_shift_target" ADD CONSTRAINT "roster_shift_target_request_line_id_roster_request_line_id_fk" FOREIGN KEY ("request_line_id") REFERENCES "public"."roster_request_line"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_shift_target" ADD CONSTRAINT "roster_shift_target_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_rule" ADD CONSTRAINT "work_rule_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_rule" ADD CONSTRAINT "work_rule_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_position" ADD CONSTRAINT "worker_position_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_position" ADD CONSTRAINT "worker_position_position_id_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."position"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_substitute_worker_date_unique" ON "attendance_substitute" USING btree ("substitute_worker_id","work_date");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "department_locationId_lowerName_active_unique" ON "department" USING btree ("location_id",lower("name")) WHERE "department"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "sub_department_departmentId_lowerName_active_unique" ON "sub_department" USING btree ("department_id",lower("name")) WHERE "sub_department"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "location_lowerName_active_unique" ON "location" USING btree (lower("name")) WHERE "location"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "position_lowerName_active_unique" ON "position" USING btree (lower("name")) WHERE "position"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "roster_request_locationId_idx" ON "roster_request" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "roster_request_status_startDate_idx" ON "roster_request" USING btree ("status","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_request_line_unique" ON "roster_request_line" USING btree ("request_id","department_id",coalesce("sub_department_id", '00000000-0000-0000-0000-000000000000'::uuid),"position_id",coalesce("shift_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "roster_request_line_requestId_idx" ON "roster_request_line" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_assignment_roster_worker_date_unique" ON "roster_assignment" USING btree ("roster_id","worker_id","work_date");--> statement-breakpoint
CREATE INDEX "roster_assignment_workDate_idx" ON "roster_assignment" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "roster_assignment_workerId_workDate_idx" ON "roster_assignment" USING btree ("worker_id","work_date");--> statement-breakpoint
CREATE INDEX "roster_cell_edit_roster_workDate_idx" ON "roster_cell_edit" USING btree ("roster_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_locationId_order_active_unique" ON "shift" USING btree ("location_id","order") WHERE "shift"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "shift_locationId_lowerName_active_unique" ON "shift" USING btree ("location_id",lower("name")) WHERE "shift"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_rule_global_unique" ON "work_rule" USING btree ("scope") WHERE "work_rule"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "work_rule_location_unique" ON "work_rule" USING btree ("location_id") WHERE "work_rule"."scope" = 'location';--> statement-breakpoint
CREATE UNIQUE INDEX "worker_lowerEmployeeId_active_unique" ON "worker" USING btree (lower("employee_id")) WHERE "worker"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "worker_locationId_idx" ON "worker" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "worker_position_positionId_idx" ON "worker_position" USING btree ("position_id");