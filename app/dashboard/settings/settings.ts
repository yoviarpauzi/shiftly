import "server-only";
import { and, asc, eq, isNull, type SQL } from "drizzle-orm";
import { notFound } from "next/navigation";
import { location } from "@/database/schema/location-schema";
import { workRule } from "@/database/schema/work-rule-schema";
import { db } from "@/lib/db";
import type {
  LocationChoice,
  LocationWorkRules,
  SettingsAccess,
  SettingsTarget,
  WorkRuleKey,
  WorkRuleRow,
} from "@/types/settings";
import { resolveWorkRules, WORK_RULE_DEFAULTS } from "./settings-rules";

const RULE_KEYS = Object.keys(WORK_RULE_DEFAULTS) as WorkRuleKey[];

export const ruleColumns = {
  workDaysPerWeek: workRule.workDaysPerWeek,
  breakDays: workRule.breakDays,
  breakCycleMonths: workRule.breakCycleMonths,
  annualOffDays: workRule.annualOffDays,
  shiftExceptionDays: workRule.shiftExceptionDays,
  requirePositionMatch: workRule.requirePositionMatch,
  keepPreviousPlacement: workRule.keepPreviousPlacement,
  maxWorkingDaysPerMonth: workRule.maxWorkingDaysPerMonth,
};

// Admin site gets its own location as fixed text. HO picks from every active location.
export async function settingsLocationChoiceFor(access: SettingsAccess): Promise<LocationChoice> {
  if (access.role === "admin_site" && access.locationId) {
    const [own] = await db
      .select({ id: location.id, name: location.name })
      .from(location)
      .where(and(eq(location.id, access.locationId), isNull(location.deletedAt)));

    if (!own) {
      notFound();
    }

    return { mode: "fixed", location: own };
  }

  const locations = await db
    .select({ id: location.id, name: location.name })
    .from(location)
    .where(isNull(location.deletedAt))
    .orderBy(asc(location.name), asc(location.id));

  return { mode: "pick", locations };
}

async function ruleRow(where: SQL | undefined): Promise<WorkRuleRow | null> {
  const [row] = await db.select(ruleColumns).from(workRule).where(where);

  return row ?? null;
}

// The rows of the chosen level and the global row above it, resolved rule by rule. own[key] says
// whether the chosen level sets that rule itself. Null when the location is not active.
// The caller picks the location from settingsLocationChoiceFor, so the target is already inside
// the caller's scope.
export async function workRulesFor(target: SettingsTarget): Promise<LocationWorkRules | null> {
  let locationId: string | null = null;
  let locationName: string | null = null;

  if (target.scope === "location") {
    if (!target.locationId) {
      return null;
    }

    const [found] = await db
      .select({ id: location.id, name: location.name })
      .from(location)
      .where(and(eq(location.id, target.locationId), isNull(location.deletedAt)));

    if (!found) {
      return null;
    }

    ({ id: locationId, name: locationName } = found);
  }

  const [globalRow, locationRow] = await Promise.all([
    ruleRow(eq(workRule.scope, "global")),
    locationId
      ? ruleRow(and(eq(workRule.scope, "location"), eq(workRule.locationId, locationId)))
      : null,
  ]);

  const chosen = target.scope === "location" ? locationRow : globalRow;
  const own = Object.fromEntries(
    RULE_KEYS.map((key) => [key, (chosen?.[key] ?? null) !== null]),
  ) as Record<WorkRuleKey, boolean>;

  return {
    scope: target.scope,
    locationId,
    locationName,
    resolved: resolveWorkRules({ global: globalRow, location: locationRow }),
    own,
  };
}
