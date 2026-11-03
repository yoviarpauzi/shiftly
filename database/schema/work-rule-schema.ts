import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { WorkDays, WorkRuleScope } from "@/types/settings";
// A relative path: drizzle-kit does not reliably resolve the "@/" alias for value imports.
import { WORK_RULE_LIMITS } from "../../validation/settings";
import { user } from "./auth-schema";
import { location } from "./location-schema";
import { site } from "./site-schema";

const { breakDays, breakCycleMonths, annualOffDays, shiftExceptionDays, maxWorkingDaysPerMonth } =
  WORK_RULE_LIMITS;

// A null column means the level does not set that rule, so the next level up decides.
export const workRule = pgTable(
  "work_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: text("scope").$type<WorkRuleScope>().notNull(),
    siteId: uuid("site_id").references(() => site.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => location.id, { onDelete: "restrict" }),
    workDaysPerWeek: smallint("work_days_per_week").$type<WorkDays>(),
    breakDays: smallint("break_days"),
    breakCycleMonths: smallint("break_cycle_months"),
    annualOffDays: smallint("annual_off_days"),
    shiftExceptionDays: smallint("shift_exception_days"),
    requirePositionMatch: boolean("require_position_match"),
    maxWorkingDaysPerMonth: smallint("max_working_days_per_month"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    check("work_rule_scope_check", sql`${table.scope} in ('global', 'site', 'location')`),
    check(
      "work_rule_target_check",
      sql`(${table.scope} = 'global' and ${table.siteId} is null and ${table.locationId} is null)
        or (${table.scope} = 'site' and ${table.siteId} is not null and ${table.locationId} is null)
        or (${table.scope} = 'location' and ${table.locationId} is not null and ${table.siteId} is null)`,
    ),
    check(
      "work_rule_work_days_check",
      sql`${table.workDaysPerWeek} is null or ${table.workDaysPerWeek} in (5, 7)`,
    ),
    check(
      "work_rule_break_days_check",
      sql`${table.breakDays} is null or ${table.breakDays} between ${sql.raw(String(breakDays.min))} and ${sql.raw(String(breakDays.max))}`,
    ),
    check(
      "work_rule_break_cycle_months_check",
      sql`${table.breakCycleMonths} is null or ${table.breakCycleMonths} between ${sql.raw(String(breakCycleMonths.min))} and ${sql.raw(String(breakCycleMonths.max))}`,
    ),
    check(
      "work_rule_annual_off_days_check",
      sql`${table.annualOffDays} is null or ${table.annualOffDays} between ${sql.raw(String(annualOffDays.min))} and ${sql.raw(String(annualOffDays.max))}`,
    ),
    check(
      "work_rule_shift_exception_days_check",
      sql`${table.shiftExceptionDays} is null or ${table.shiftExceptionDays} between ${sql.raw(String(shiftExceptionDays.min))} and ${sql.raw(String(shiftExceptionDays.max))}`,
    ),
    check(
      "work_rule_max_working_days_per_month_check",
      sql`${table.maxWorkingDaysPerMonth} is null or ${table.maxWorkingDaysPerMonth} between ${sql.raw(String(maxWorkingDaysPerMonth.min))} and ${sql.raw(String(maxWorkingDaysPerMonth.max))}`,
    ),
    uniqueIndex("work_rule_global_unique").on(table.scope).where(sql`${table.scope} = 'global'`),
    uniqueIndex("work_rule_site_unique").on(table.siteId).where(sql`${table.scope} = 'site'`),
    uniqueIndex("work_rule_location_unique")
      .on(table.locationId)
      .where(sql`${table.scope} = 'location'`),
  ],
);
