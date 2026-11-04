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
ALTER TABLE "roster" ADD CONSTRAINT "roster_request_id_roster_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."roster_request"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster" ADD CONSTRAINT "roster_generated_by_user_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster" ADD CONSTRAINT "roster_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_assignment" ADD CONSTRAINT "roster_assignment_roster_id_roster_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_assignment" ADD CONSTRAINT "roster_assignment_request_line_id_roster_request_line_id_fk" FOREIGN KEY ("request_line_id") REFERENCES "public"."roster_request_line"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_assignment" ADD CONSTRAINT "roster_assignment_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_assignment" ADD CONSTRAINT "roster_assignment_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
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
CREATE UNIQUE INDEX "roster_assignment_roster_worker_date_unique" ON "roster_assignment" USING btree ("roster_id","worker_id","work_date");--> statement-breakpoint
CREATE INDEX "roster_assignment_workDate_idx" ON "roster_assignment" USING btree ("work_date");