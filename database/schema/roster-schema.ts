import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AssignmentKind, RosterStatus } from "@/types/rosters";
import { user } from "./auth-schema";
import { rosterRequest, rosterRequestLine } from "./request-schema";
import { shift } from "./shift-schema";
import { worker } from "./worker-schema";

// One roster per approved request. A draft can be generated again and edited. A confirmed roster is
// locked: its rows are never rewritten.
export const roster = pgTable(
  "roster",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .unique()
      .references(() => rosterRequest.id, { onDelete: "restrict" }),
    status: text("status").$type<RosterStatus>().notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    generatedBy: text("generated_by").references(() => user.id, { onDelete: "set null" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: text("confirmed_by").references(() => user.id, { onDelete: "set null" }),
    // The roster's version: an action compares it with the one the page loaded.
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("roster_status_check", sql`${table.status} in ('draft', 'confirmed')`),
    check(
      "roster_confirmed_at_check",
      sql`(${table.status} = 'confirmed') = (${table.confirmedAt} is not null)`,
    ),
  ],
);

// How many workers each shift needs on a day: the split typed on the Generate screen.
export const rosterShiftTarget = pgTable(
  "roster_shift_target",
  {
    rosterId: uuid("roster_id")
      .notNull()
      .references(() => roster.id, { onDelete: "cascade" }),
    requestLineId: uuid("request_line_id")
      .notNull()
      .references(() => rosterRequestLine.id, { onDelete: "restrict" }),
    workDate: date("work_date", { mode: "string" }).notNull(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "restrict" }),
    headcount: smallint("headcount").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.rosterId, table.requestLineId, table.workDate, table.shiftId],
    }),
    check("roster_shift_target_headcount_check", sql`${table.headcount} between 0 and 999`),
  ],
);

// One row per worker and day. A work row has a shift. An off or break row has none.
export const rosterAssignment = pgTable(
  "roster_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rosterId: uuid("roster_id")
      .notNull()
      .references(() => roster.id, { onDelete: "cascade" }),
    requestLineId: uuid("request_line_id")
      .notNull()
      .references(() => rosterRequestLine.id, { onDelete: "restrict" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "restrict" }),
    workDate: date("work_date", { mode: "string" }).notNull(),
    kind: text("kind").$type<AssignmentKind>().notNull(),
    shiftId: uuid("shift_id").references(() => shift.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("roster_assignment_roster_worker_date_unique").on(
      table.rosterId,
      table.workerId,
      table.workDate,
    ),
    index("roster_assignment_workDate_idx").on(table.workDate),
    check("roster_assignment_kind_check", sql`${table.kind} in ('work', 'off', 'break')`),
    check(
      "roster_assignment_shift_check",
      sql`(${table.kind} = 'work') = (${table.shiftId} is not null)`,
    ),
  ],
);

// A shift the rules could not fill, with the reason.
export const rosterConflict = pgTable("roster_conflict", {
  id: uuid("id").primaryKey().defaultRandom(),
  rosterId: uuid("roster_id")
    .notNull()
    .references(() => roster.id, { onDelete: "cascade" }),
  requestLineId: uuid("request_line_id")
    .notNull()
    .references(() => rosterRequestLine.id, { onDelete: "restrict" }),
  workDate: date("work_date", { mode: "string" }).notNull(),
  shiftId: uuid("shift_id").references(() => shift.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  shortfall: smallint("shortfall").notNull(),
  message: text("message").notNull(),
});

// An audit trail of manual replacements. The assignments themselves are updated in place.
export const rosterEdit = pgTable("roster_edit", {
  id: uuid("id").primaryKey().defaultRandom(),
  rosterId: uuid("roster_id")
    .notNull()
    .references(() => roster.id, { onDelete: "cascade" }),
  requestLineId: uuid("request_line_id")
    .notNull()
    .references(() => rosterRequestLine.id, { onDelete: "restrict" }),
  fromWorkerId: uuid("from_worker_id")
    .notNull()
    .references(() => worker.id, { onDelete: "restrict" }),
  toWorkerId: uuid("to_worker_id")
    .notNull()
    .references(() => worker.id, { onDelete: "restrict" }),
  editedBy: text("edited_by").references(() => user.id, { onDelete: "set null" }),
  editedAt: timestamp("edited_at", { withTimezone: true }).defaultNow().notNull(),
});

// An audit trail of cell edits on the grid. A cell is one worker and day: its before and after are
// a kind and a shift. A null kind is an empty cell, so a work kind has a shift and no other kind does.
export const rosterCellEdit = pgTable(
  "roster_cell_edit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rosterId: uuid("roster_id")
      .notNull()
      .references(() => roster.id, { onDelete: "cascade" }),
    requestLineId: uuid("request_line_id")
      .notNull()
      .references(() => rosterRequestLine.id, { onDelete: "restrict" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "restrict" }),
    workDate: date("work_date", { mode: "string" }).notNull(),
    beforeKind: text("before_kind").$type<AssignmentKind>(),
    beforeShiftId: uuid("before_shift_id").references(() => shift.id, { onDelete: "restrict" }),
    afterKind: text("after_kind").$type<AssignmentKind>(),
    afterShiftId: uuid("after_shift_id").references(() => shift.id, { onDelete: "restrict" }),
    editedBy: text("edited_by").references(() => user.id, { onDelete: "set null" }),
    editedAt: timestamp("edited_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("roster_cell_edit_roster_workDate_idx").on(table.rosterId, table.workDate),
    check(
      "roster_cell_edit_before_check",
      sql`(${table.beforeKind} is null or ${table.beforeKind} in ('work', 'off', 'break')) and (coalesce(${table.beforeKind} = 'work', false) = (${table.beforeShiftId} is not null))`,
    ),
    check(
      "roster_cell_edit_after_check",
      sql`(${table.afterKind} is null or ${table.afterKind} in ('work', 'off', 'break')) and (coalesce(${table.afterKind} = 'work', false) = (${table.afterShiftId} is not null))`,
    ),
  ],
);
