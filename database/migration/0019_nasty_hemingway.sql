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
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_roster_id_roster_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_request_line_id_roster_request_line_id_fk" FOREIGN KEY ("request_line_id") REFERENCES "public"."roster_request_line"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_before_shift_id_shift_id_fk" FOREIGN KEY ("before_shift_id") REFERENCES "public"."shift"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_after_shift_id_shift_id_fk" FOREIGN KEY ("after_shift_id") REFERENCES "public"."shift"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cell_edit" ADD CONSTRAINT "roster_cell_edit_edited_by_user_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roster_cell_edit_roster_workDate_idx" ON "roster_cell_edit" USING btree ("roster_id","work_date");