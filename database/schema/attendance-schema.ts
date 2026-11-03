import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { AttendanceStatus } from "@/types/attendance";
import { ATTENDANCE_STATUS_VALUES, REASON_MAX_LENGTH } from "@/validation/attendance";
import { user } from "./auth-schema";
import { rosterAssignment } from "./roster-schema";

const STATUS_LIST = sql.raw(ATTENDANCE_STATUS_VALUES.map((status) => `'${status}'`).join(", "));

// One row per scheduled work shift that has been marked. "Not marked" is no row, never a status.
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rosterAssignmentId: uuid("roster_assignment_id")
      .notNull()
      .unique()
      .references(() => rosterAssignment.id, { onDelete: "restrict" }),
    status: text("status").$type<AttendanceStatus>().notNull(),
    reason: text("reason"),
    markedBy: text("marked_by").references(() => user.id, { onDelete: "set null" }),
    markedAt: timestamp("marked_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("attendance_status_check", sql`${table.status} in (${STATUS_LIST})`),
    check(
      "attendance_reason_check",
      sql`${table.reason} is null or char_length(${table.reason}) <= ${sql.raw(String(REASON_MAX_LENGTH))}`,
    ),
  ],
);
