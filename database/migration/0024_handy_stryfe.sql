CREATE TABLE "billing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text,
	"site_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by" text,
	"issued_at" timestamp with time zone,
	"voided_by" text,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_mode_check" CHECK ("billing"."mode" in ('monthly', 'weekly', 'custom')),
	CONSTRAINT "billing_status_check" CHECK ("billing"."status" in ('draft', 'issued', 'void')),
	CONSTRAINT "billing_period_check" CHECK ("billing"."period_start" <= "billing"."period_end"),
	CONSTRAINT "billing_void_reason_check" CHECK (char_length("billing"."void_reason") <= 200),
	CONSTRAINT "billing_state_check" CHECK (("billing"."status" = 'draft' and "billing"."number" is null and "billing"."issued_at" is null and "billing"."voided_at" is null) or ("billing"."status" = 'issued' and "billing"."number" is not null and "billing"."issued_at" is not null and "billing"."voided_at" is null) or ("billing"."status" = 'void' and "billing"."number" is not null and "billing"."issued_at" is not null and "billing"."voided_at" is not null and "billing"."void_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "billing_attendance" (
	"billing_id" uuid NOT NULL,
	"attendance_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_counter" (
	"site_id" uuid NOT NULL,
	"period" text NOT NULL,
	"last_value" integer NOT NULL,
	CONSTRAINT "billing_counter_site_id_period_pk" PRIMARY KEY("site_id","period")
);
--> statement-breakpoint
CREATE TABLE "billing_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"po_number" text NOT NULL,
	"department_id" uuid NOT NULL,
	"department_name" text NOT NULL,
	"sub_department_id" uuid,
	"sub_department_name" text,
	"position_id" uuid NOT NULL,
	"position_name" text NOT NULL,
	"days" integer NOT NULL,
	CONSTRAINT "billing_line_days_check" CHECK ("billing_line"."days" >= 1)
);
--> statement-breakpoint
ALTER TABLE "billing" ADD CONSTRAINT "billing_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing" ADD CONSTRAINT "billing_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing" ADD CONSTRAINT "billing_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing" ADD CONSTRAINT "billing_issued_by_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing" ADD CONSTRAINT "billing_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_attendance" ADD CONSTRAINT "billing_attendance_billing_id_billing_id_fk" FOREIGN KEY ("billing_id") REFERENCES "public"."billing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_attendance" ADD CONSTRAINT "billing_attendance_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_counter" ADD CONSTRAINT "billing_counter_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_line" ADD CONSTRAINT "billing_line_billing_id_billing_id_fk" FOREIGN KEY ("billing_id") REFERENCES "public"."billing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_line" ADD CONSTRAINT "billing_line_request_id_roster_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."roster_request"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_line" ADD CONSTRAINT "billing_line_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_line" ADD CONSTRAINT "billing_line_sub_department_id_sub_department_id_fk" FOREIGN KEY ("sub_department_id") REFERENCES "public"."sub_department"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_line" ADD CONSTRAINT "billing_line_position_id_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."position"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_number_unique" ON "billing" USING btree ("number");--> statement-breakpoint
CREATE INDEX "billing_locationId_status_idx" ON "billing" USING btree ("location_id","status");--> statement-breakpoint
CREATE INDEX "billing_siteId_idx" ON "billing" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "billing_attendance_billingId_idx" ON "billing_attendance" USING btree ("billing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_line_unique" ON "billing_line" USING btree ("billing_id","request_id","department_id",coalesce("sub_department_id", '00000000-0000-0000-0000-000000000000'::uuid),"position_id");