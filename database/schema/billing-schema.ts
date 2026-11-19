import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { BillingMode, BillingStatus } from "@/types/billings";
import { attendance } from "./attendance-schema";
import { user } from "./auth-schema";
import { department, subDepartment } from "./department-schema";
import { location } from "./location-schema";
import { position } from "./position-schema";
import { rosterRequest } from "./request-schema";
import { site } from "./site-schema";

// A billing covers one location and a period. A draft has no number and is recomputed on every read.
// Issuing sets the number and writes the lines and the billed days. Voiding frees the billed days.
export const billing = pgTable(
  "billing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null while a draft. BL-{site code}-{YYYYMM}-{sequence}, set at Issue.
    number: text("number"),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    mode: text("mode").$type<BillingMode>().notNull(),
    // Inclusive on both ends.
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    status: text("status").$type<BillingStatus>().notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    issuedBy: text("issued_by").references(() => user.id, { onDelete: "set null" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    voidedBy: text("voided_by").references(() => user.id, { onDelete: "set null" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    // The billing's version: an action compares it with the one the page loaded.
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // A plain unique index: nulls are distinct, so any number of drafts have no number.
    uniqueIndex("billing_number_unique").on(table.number),
    index("billing_locationId_status_idx").on(table.locationId, table.status),
    index("billing_siteId_idx").on(table.siteId),
    check("billing_mode_check", sql`${table.mode} in ('monthly', 'weekly', 'custom')`),
    check("billing_status_check", sql`${table.status} in ('draft', 'issued', 'void')`),
    check("billing_period_check", sql`${table.periodStart} <= ${table.periodEnd}`),
    check("billing_void_reason_check", sql`char_length(${table.voidReason}) <= 200`),
    check(
      "billing_state_check",
      sql`(${table.status} = 'draft' and ${table.number} is null and ${table.issuedAt} is null and ${table.voidedAt} is null) or (${table.status} = 'issued' and ${table.number} is not null and ${table.issuedAt} is not null and ${table.voidedAt} is null) or (${table.status} = 'void' and ${table.number} is not null and ${table.issuedAt} is not null and ${table.voidedAt} is not null and ${table.voidReason} is not null)`,
    ),
  ],
);

// One row per site and month. The server bumps lastValue in a single upsert to issue a billing number.
export const billingCounter = pgTable(
  "billing_counter",
  {
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "restrict" }),
    // YYYYMM
    period: text("period").notNull(),
    lastValue: integer("last_value").notNull(),
  },
  (table) => [primaryKey({ columns: [table.siteId, table.period] })],
);

// One row per PO, department, sub-department, and position, written at Issue. The names are
// snapshots so an issued billing does not change when master data is renamed or deleted.
export const billingLine = pgTable(
  "billing_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingId: uuid("billing_id")
      .notNull()
      .references(() => billing.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => rosterRequest.id, { onDelete: "restrict" }),
    poNumber: text("po_number").notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => department.id, { onDelete: "restrict" }),
    departmentName: text("department_name").notNull(),
    subDepartmentId: uuid("sub_department_id").references(() => subDepartment.id, {
      onDelete: "restrict",
    }),
    subDepartmentName: text("sub_department_name"),
    positionId: uuid("position_id")
      .notNull()
      .references(() => position.id, { onDelete: "restrict" }),
    positionName: text("position_name").notNull(),
    days: integer("days").notNull(),
  },
  (table) => [
    // A null sub-department is folded to the zero uuid so two such lines still collide.
    uniqueIndex("billing_line_unique").on(
      table.billingId,
      table.requestId,
      table.departmentId,
      sql`coalesce(${table.subDepartmentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.positionId,
    ),
    check("billing_line_days_check", sql`${table.days} >= 1`),
  ],
);

// One row per billed day, deleted at Void. The primary key on attendanceId is the guard against
// billing a day twice, and the restrict key keeps a billed attendance row from being deleted.
export const billingAttendance = pgTable(
  "billing_attendance",
  {
    billingId: uuid("billing_id")
      .notNull()
      .references(() => billing.id, { onDelete: "cascade" }),
    attendanceId: uuid("attendance_id")
      .primaryKey()
      .references(() => attendance.id, { onDelete: "restrict" }),
  },
  (table) => [index("billing_attendance_billingId_idx").on(table.billingId)],
);
