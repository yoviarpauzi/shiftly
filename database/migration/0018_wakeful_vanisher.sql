CREATE TABLE "work_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"site_id" uuid,
	"location_id" uuid,
	"work_days_per_week" smallint,
	"break_days" smallint,
	"break_cycle_months" smallint,
	"annual_off_days" smallint,
	"shift_exception_days" smallint,
	"require_position_match" boolean,
	"max_working_days_per_month" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "work_rule_scope_check" CHECK ("work_rule"."scope" in ('global', 'site', 'location')),
	CONSTRAINT "work_rule_target_check" CHECK (("work_rule"."scope" = 'global' and "work_rule"."site_id" is null and "work_rule"."location_id" is null)
        or ("work_rule"."scope" = 'site' and "work_rule"."site_id" is not null and "work_rule"."location_id" is null)
        or ("work_rule"."scope" = 'location' and "work_rule"."location_id" is not null and "work_rule"."site_id" is null)),
	CONSTRAINT "work_rule_work_days_check" CHECK ("work_rule"."work_days_per_week" is null or "work_rule"."work_days_per_week" in (5, 7)),
	CONSTRAINT "work_rule_break_days_check" CHECK ("work_rule"."break_days" is null or "work_rule"."break_days" between 1 and 31),
	CONSTRAINT "work_rule_break_cycle_months_check" CHECK ("work_rule"."break_cycle_months" is null or "work_rule"."break_cycle_months" between 1 and 12),
	CONSTRAINT "work_rule_annual_off_days_check" CHECK ("work_rule"."annual_off_days" is null or "work_rule"."annual_off_days" between 0 and 366),
	CONSTRAINT "work_rule_shift_exception_days_check" CHECK ("work_rule"."shift_exception_days" is null or "work_rule"."shift_exception_days" between 1 and 30),
	CONSTRAINT "work_rule_max_working_days_per_month_check" CHECK ("work_rule"."max_working_days_per_month" is null or "work_rule"."max_working_days_per_month" between 1 and 31)
);
--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "work_days_per_week" smallint;--> statement-breakpoint
ALTER TABLE "work_rule" ADD CONSTRAINT "work_rule_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_rule" ADD CONSTRAINT "work_rule_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_rule" ADD CONSTRAINT "work_rule_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_rule_global_unique" ON "work_rule" USING btree ("scope") WHERE "work_rule"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "work_rule_site_unique" ON "work_rule" USING btree ("site_id") WHERE "work_rule"."scope" = 'site';--> statement-breakpoint
CREATE UNIQUE INDEX "work_rule_location_unique" ON "work_rule" USING btree ("location_id") WHERE "work_rule"."scope" = 'location';--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_work_days_check" CHECK ("worker"."work_days_per_week" in (5, 7));