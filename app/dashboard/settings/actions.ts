"use server";

import "server-only";
import { APIError } from "better-auth/api";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { workRule } from "@/database/schema/work-rule-schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type {
  PasswordActionResult,
  PasswordField,
  SettingsAccess,
  WorkRuleAccessTarget,
  WorkRuleRow,
  WorkRulesActionResult,
} from "@/types/settings";
import {
  annualOffRuleSchema,
  breakRuleSchema,
  changePasswordSchema,
  maxWorkingDaysRuleSchema,
  qualificationRuleSchema,
  shiftChangeRuleSchema,
  workDaysRuleSchema,
  type AnnualOffRuleInput,
  type BreakRuleInput,
  type ChangePasswordInput,
  type MaxWorkingDaysRuleInput,
  type QualificationRuleInput,
  type ShiftChangeRuleInput,
  type WorkDaysRuleInput,
  type WorkRuleTarget,
} from "@/validation/settings";
import { canEditWorkRule, canViewWorkRule } from "./settings-access";
import { requireSettingsAccess } from "./settings-guard";
import {
  INCORRECT_PASSWORD_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  READ_ONLY_MESSAGE,
  SITE_NOT_FOUND_MESSAGE,
} from "./settings-rules";

const SETTINGS_PATH = "/dashboard/settings";

const PASSWORD_FIELDS: PasswordField[] = ["currentPassword", "newPassword", "confirmPassword"];

// revokeOtherSessions is always true: there is no input for it. better-auth then replaces every
// session of the user with a new one, and nextCookies (lib/auth.ts) sets its cookie here.
export async function changePassword(input: ChangePasswordInput): Promise<PasswordActionResult> {
  await requireUser();

  const parsed = changePasswordSchema.safeParse(input);

  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const field = issue.path[0] as PasswordField;

    return PASSWORD_FIELDS.includes(field)
      ? { ok: false, fieldErrors: { [field]: issue.message } }
      : { ok: false, formError: issue.message };
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      return { ok: false, fieldErrors: { currentPassword: INCORRECT_PASSWORD_MESSAGE } };
    }

    throw error;
  }

  return { ok: true };
}

function notFoundFor(target: WorkRuleTarget): WorkRulesActionResult {
  return {
    ok: false,
    formError: target.scope === "location" ? LOCATION_NOT_FOUND_MESSAGE : SITE_NOT_FOUND_MESSAGE,
  };
}

function invalid(issues: { message: string }[]): WorkRulesActionResult {
  return { ok: false, formError: issues[0].message };
}

// The one write path for the six cards. It loads the site or location, checks the caller against
// it, then upserts the row of that level with only the card's columns. The share lock conflicts
// with the update lock a delete takes, so the target cannot be deleted between check and write.
// updatedAt is set by hand because $onUpdate does not run inside onConflictDoUpdate.
async function saveWorkRule(
  access: SettingsAccess | null,
  target: WorkRuleTarget,
  columns: Partial<WorkRuleRow>,
): Promise<WorkRulesActionResult> {
  if (!access) {
    return notFoundFor(target);
  }

  const result = await db.transaction(async (tx) => {
    let checked: WorkRuleAccessTarget = {
      scope: "global",
      siteId: null,
      locationId: null,
      locationSiteId: null,
    };

    if (target.scope === "site") {
      const [found] = await tx
        .select({ id: site.id })
        .from(site)
        .where(and(eq(site.id, target.siteId), isNull(site.deletedAt)))
        .for("share");

      if (!found) {
        return notFoundFor(target);
      }

      checked = { scope: "site", siteId: found.id, locationId: null, locationSiteId: null };
    }

    if (target.scope === "location") {
      const [found] = await tx
        .select({ id: location.id, siteId: location.siteId })
        .from(location)
        .innerJoin(site, eq(site.id, location.siteId))
        .where(
          and(
            eq(location.id, target.locationId),
            isNull(location.deletedAt),
            isNull(site.deletedAt),
          ),
        )
        .for("share");

      if (!found) {
        return notFoundFor(target);
      }

      checked = {
        scope: "location",
        siteId: null,
        locationId: found.id,
        locationSiteId: found.siteId,
      };
    }

    if (!canViewWorkRule(access, checked)) {
      return notFoundFor(target);
    }

    if (!canEditWorkRule(access, checked)) {
      return { ok: false as const, formError: READ_ONLY_MESSAGE };
    }

    const set = { ...columns, updatedBy: access.userId, updatedAt: new Date() };

    if (checked.scope === "site") {
      await tx
        .insert(workRule)
        .values({ scope: "site", siteId: checked.siteId, ...set })
        .onConflictDoUpdate({
          target: workRule.siteId,
          targetWhere: sql`scope = 'site'`,
          set,
        });
    } else if (checked.scope === "location") {
      await tx
        .insert(workRule)
        .values({ scope: "location", locationId: checked.locationId, ...set })
        .onConflictDoUpdate({
          target: workRule.locationId,
          targetWhere: sql`scope = 'location'`,
          set,
        });
    } else {
      await tx
        .insert(workRule)
        .values({ scope: "global", ...set })
        .onConflictDoUpdate({
          target: workRule.scope,
          targetWhere: sql`scope = 'global'`,
          set,
        });
    }

    return { ok: true as const };
  });

  if (result.ok) {
    revalidatePath(SETTINGS_PATH);
  }

  return result;
}

export async function updateWorkRuleWorkDays(
  input: WorkDaysRuleInput,
): Promise<WorkRulesActionResult> {
  const access = await requireSettingsAccess();
  const parsed = workDaysRuleSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const { target, workDaysPerWeek } = parsed.data;

  return saveWorkRule(access, target, { workDaysPerWeek });
}

export async function updateWorkRuleBreak(input: BreakRuleInput): Promise<WorkRulesActionResult> {
  const access = await requireSettingsAccess();
  const parsed = breakRuleSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const { target, breakDays, breakCycleMonths } = parsed.data;

  return saveWorkRule(access, target, { breakDays, breakCycleMonths });
}

export async function updateWorkRuleAnnualOff(
  input: AnnualOffRuleInput,
): Promise<WorkRulesActionResult> {
  const access = await requireSettingsAccess();
  const parsed = annualOffRuleSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const { target, annualOffDays } = parsed.data;

  return saveWorkRule(access, target, { annualOffDays });
}

export async function updateWorkRuleShiftChange(
  input: ShiftChangeRuleInput,
): Promise<WorkRulesActionResult> {
  const access = await requireSettingsAccess();
  const parsed = shiftChangeRuleSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const { target, shiftExceptionDays } = parsed.data;

  return saveWorkRule(access, target, { shiftExceptionDays });
}

export async function updateWorkRuleQualification(
  input: QualificationRuleInput,
): Promise<WorkRulesActionResult> {
  const access = await requireSettingsAccess();
  const parsed = qualificationRuleSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const { target, requirePositionMatch } = parsed.data;

  return saveWorkRule(access, target, { requirePositionMatch });
}

export async function updateWorkRuleMaxWorkingDays(
  input: MaxWorkingDaysRuleInput,
): Promise<WorkRulesActionResult> {
  const access = await requireSettingsAccess();
  const parsed = maxWorkingDaysRuleSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const { target, maxWorkingDaysPerMonth } = parsed.data;

  return saveWorkRule(access, target, { maxWorkingDaysPerMonth });
}
