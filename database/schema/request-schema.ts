import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { department, subDepartment } from "./department-schema";
import { location } from "./location-schema";
import { position } from "./position-schema";
import { shift } from "./shift-schema";
import { site } from "./site-schema";

// One row per site and month. The server bumps lastValue in a single upsert to issue a PO number.
export const poCounter = pgTable(
  "po_counter",
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

export const rosterRequest = pgTable(
  "roster_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poNumber: text("po_number").notNull().unique(),
    // daily or weekly. Locked after creation.
    type: text("type").notNull(),
    // Daily: the day. Weekly: the first of 7 days.
    startDate: date("start_date", { mode: "string" }).notNull(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    // pending, approved, rejected, or cancelled.
    status: text("status").notNull(),
    rejectReason: text("reject_reason"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => user.id),
    decidedBy: text("decided_by").references(() => user.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("roster_request_type_check", sql`${table.type} in ('daily', 'weekly')`),
    check(
      "roster_request_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected', 'cancelled')`,
    ),
    index("roster_request_siteId_idx").on(table.siteId),
    index("roster_request_locationId_idx").on(table.locationId),
    index("roster_request_status_startDate_idx").on(table.status, table.startDate),
  ],
);

export const rosterRequestLine = pgTable(
  "roster_request_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => rosterRequest.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => department.id, { onDelete: "restrict" }),
    subDepartmentId: uuid("sub_department_id").references(() => subDepartment.id, {
      onDelete: "restrict",
    }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => position.id, { onDelete: "restrict" }),
    // Null is Any shift: the roster may split the line across the location's shifts.
    shiftId: uuid("shift_id").references(() => shift.id, { onDelete: "restrict" }),
  },
  (table) => [
    // A null sub-department or shift is folded to the zero uuid so two such lines still collide.
    uniqueIndex("roster_request_line_unique").on(
      table.requestId,
      table.departmentId,
      sql`coalesce(${table.subDepartmentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.positionId,
      sql`coalesce(${table.shiftId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    index("roster_request_line_requestId_idx").on(table.requestId),
  ],
);

// One headcount per day of a request line. dayOffset counts from the request's start date.
export const rosterRequestLineDay = pgTable(
  "roster_request_line_day",
  {
    lineId: uuid("line_id")
      .notNull()
      .references(() => rosterRequestLine.id, { onDelete: "cascade" }),
    // 0 to 6. A daily request only has 0.
    dayOffset: smallint("day_offset").notNull(),
    headcount: integer("headcount").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.lineId, table.dayOffset] }),
    check("roster_request_line_day_offset_check", sql`${table.dayOffset} between 0 and 6`),
    check(
      "roster_request_line_day_headcount_check",
      sql`${table.headcount} between 0 and 999`,
    ),
  ],
);

export const rosterRequestRelations = relations(rosterRequest, ({ one, many }) => ({
  site: one(site, {
    fields: [rosterRequest.siteId],
    references: [site.id],
  }),
  location: one(location, {
    fields: [rosterRequest.locationId],
    references: [location.id],
  }),
  lines: many(rosterRequestLine),
}));

export const rosterRequestLineRelations = relations(rosterRequestLine, ({ one, many }) => ({
  request: one(rosterRequest, {
    fields: [rosterRequestLine.requestId],
    references: [rosterRequest.id],
  }),
  department: one(department, {
    fields: [rosterRequestLine.departmentId],
    references: [department.id],
  }),
  subDepartment: one(subDepartment, {
    fields: [rosterRequestLine.subDepartmentId],
    references: [subDepartment.id],
  }),
  position: one(position, {
    fields: [rosterRequestLine.positionId],
    references: [position.id],
  }),
  days: many(rosterRequestLineDay),
}));

export const rosterRequestLineDayRelations = relations(rosterRequestLineDay, ({ one }) => ({
  line: one(rosterRequestLine, {
    fields: [rosterRequestLineDay.lineId],
    references: [rosterRequestLine.id],
  }),
}));
