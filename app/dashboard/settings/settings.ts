import "server-only";
import { and, asc, eq, isNull, type SQL } from "drizzle-orm";
import { notFound } from "next/navigation";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { workRule } from "@/database/schema/work-rule-schema";
import { db } from "@/lib/db";
import type { SiteChoice } from "@/types/locations";
import type {
  LocationChoice,
  LocationWorkRules,
  SettingsAccess,
  WorkRuleAccessTarget,
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

// HO and admin site get their own site as fixed text. Superadmin picks from the active sites.
export async function settingsSiteChoiceFor(access: SettingsAccess): Promise<SiteChoice> {
  if (access.siteId) {
    const [own] = await db
      .select({ id: site.id, name: site.name })
      .from(site)
      .where(and(eq(site.id, access.siteId), isNull(site.deletedAt)));

    if (!own) {
      notFound();
    }

    return { mode: "fixed", site: own };
  }

  const sites = await db
    .select({ id: site.id, name: site.name })
    .from(site)
    .where(isNull(site.deletedAt))
    .orderBy(asc(site.name), asc(site.id));

  return { mode: "pick", sites };
}

// Admin site gets its own location as fixed text. Superadmin and HO pick from the active
// locations of the chosen site. HO only ever sees the locations of its own site.
export async function settingsLocationChoiceFor(
  access: SettingsAccess,
  siteId: string,
): Promise<LocationChoice> {
  if (access.role === "admin_site" && access.locationId) {
    const [own] = await db
      .select({ id: location.id, name: location.name, siteId: location.siteId })
      .from(location)
      .where(and(eq(location.id, access.locationId), isNull(location.deletedAt)));

    if (!own) {
      notFound();
    }

    return { mode: "fixed", location: own };
  }

  if (access.siteId && access.siteId !== siteId) {
    return { mode: "pick", locations: [] };
  }

  const locations = await db
    .select({ id: location.id, name: location.name, siteId: location.siteId })
    .from(location)
    .where(and(eq(location.siteId, siteId), isNull(location.deletedAt)))
    .orderBy(asc(location.name), asc(location.id));

  return { mode: "pick", locations };
}

async function ruleRow(where: SQL | undefined): Promise<WorkRuleRow | null> {
  const [row] = await db.select(ruleColumns).from(workRule).where(where);

  return row ?? null;
}

// The rows of the chosen level and every level above it, resolved rule by rule. own[key] says
// whether the chosen level sets that rule itself. Null when the site or location is not active.
// The caller picks the site and location from settingsSiteChoiceFor and settingsLocationChoiceFor,
// so the target is already inside the caller's scope.
export async function workRulesFor(
  target: Omit<WorkRuleAccessTarget, "locationSiteId">,
): Promise<LocationWorkRules | null> {
  let siteId: string | null = null;
  let siteName: string | null = null;
  let locationId: string | null = null;
  let locationName: string | null = null;

  if (target.scope === "location") {
    if (!target.locationId) {
      return null;
    }

    const [found] = await db
      .select({
        id: location.id,
        name: location.name,
        siteId: site.id,
        siteName: site.name,
      })
      .from(location)
      .innerJoin(site, eq(site.id, location.siteId))
      .where(
        and(
          eq(location.id, target.locationId),
          isNull(location.deletedAt),
          isNull(site.deletedAt),
        ),
      );

    if (!found || (target.siteId !== null && target.siteId !== found.siteId)) {
      return null;
    }

    ({ id: locationId, name: locationName, siteId, siteName } = found);
  } else if (target.scope === "site") {
    if (!target.siteId) {
      return null;
    }

    const [found] = await db
      .select({ id: site.id, name: site.name })
      .from(site)
      .where(and(eq(site.id, target.siteId), isNull(site.deletedAt)));

    if (!found) {
      return null;
    }

    ({ id: siteId, name: siteName } = found);
  }

  const [globalRow, siteRow, locationRow] = await Promise.all([
    ruleRow(eq(workRule.scope, "global")),
    siteId ? ruleRow(and(eq(workRule.scope, "site"), eq(workRule.siteId, siteId))) : null,
    locationId
      ? ruleRow(and(eq(workRule.scope, "location"), eq(workRule.locationId, locationId)))
      : null,
  ]);

  const chosen = { global: globalRow, site: siteRow, location: locationRow }[target.scope];
  const own = Object.fromEntries(
    RULE_KEYS.map((key) => [key, (chosen?.[key] ?? null) !== null]),
  ) as Record<WorkRuleKey, boolean>;

  return {
    scope: target.scope,
    siteId,
    siteName,
    locationId,
    locationName,
    resolved: resolveWorkRules({ global: globalRow, site: siteRow, location: locationRow }),
    own,
  };
}
