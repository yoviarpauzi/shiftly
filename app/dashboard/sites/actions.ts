"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { user } from "@/database/schema/auth-schema";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { siteSchema, type SiteInput } from "@/validation/site";
import {
  canDeleteSite,
  DUPLICATE_NAME_MESSAGE,
  isSiteNameConflict,
  RESTORE_CONFLICT_MESSAGE,
  SITE_NOT_FOUND_MESSAGE,
  type SiteActionResult,
  type SiteBulkDeleteResult,
} from "./site-rules";

const SITES_PATH = "/dashboard/sites";

export async function createSite(input: SiteInput): Promise<SiteActionResult> {
  await requireSuperadmin();

  const parsed = siteSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0].message } };
  }

  try {
    await db.insert(site).values({ name: parsed.data.name });
  } catch (error) {
    if (isSiteNameConflict(error)) {
      return { ok: false, fieldErrors: { name: DUPLICATE_NAME_MESSAGE } };
    }

    throw error;
  }

  revalidatePath(SITES_PATH);

  return { ok: true };
}

export async function updateSite(
  id: string,
  input: SiteInput,
): Promise<SiteActionResult> {
  await requireSuperadmin();

  const parsed = siteSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0].message } };
  }

  try {
    const updated = await db
      .update(site)
      .set({ name: parsed.data.name })
      .where(and(eq(site.id, id), isNull(site.deletedAt)))
      .returning({ id: site.id });

    if (updated.length === 0) {
      return { ok: false, formError: SITE_NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    if (isSiteNameConflict(error)) {
      return { ok: false, fieldErrors: { name: DUPLICATE_NAME_MESSAGE } };
    }

    throw error;
  }

  revalidatePath(SITES_PATH);

  return { ok: true };
}

// Checks and soft-deletes one site. Callers must check the superadmin role first.
async function softDeleteSite(id: string): Promise<SiteActionResult> {
  // The row lock stops a location or user from being assigned to this site
  // until the checks have run and the change is committed.
  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: site.id })
      .from(site)
      .where(and(eq(site.id, id), isNull(site.deletedAt)))
      .for("update");

    if (!target) {
      return { ok: false as const, formError: SITE_NOT_FOUND_MESSAGE };
    }

    const [{ value: activeLocations }] = await tx
      .select({ value: count() })
      .from(location)
      .where(and(eq(location.siteId, id), isNull(location.deletedAt)));

    const [{ value: assignedUsers }] = await tx
      .select({ value: count() })
      .from(user)
      .where(eq(user.siteId, id));

    const verdict = canDeleteSite({ activeLocations, assignedUsers });

    if (!verdict.ok) {
      return { ok: false as const, formError: verdict.formError };
    }

    await tx.update(site).set({ deletedAt: new Date() }).where(eq(site.id, id));

    return { ok: true as const };
  });

  return result;
}

export async function deleteSite(id: string): Promise<SiteActionResult> {
  await requireSuperadmin();

  const result = await softDeleteSite(id);

  if (result.ok) {
    revalidatePath(SITES_PATH);
  }

  return result;
}

export async function restoreSite(id: string): Promise<SiteActionResult> {
  await requireSuperadmin();

  try {
    const restored = await db
      .update(site)
      .set({ deletedAt: null })
      .where(and(eq(site.id, id), isNotNull(site.deletedAt)))
      .returning({ id: site.id });

    if (restored.length === 0) {
      return { ok: false, formError: SITE_NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    if (isSiteNameConflict(error)) {
      return { ok: false, formError: RESTORE_CONFLICT_MESSAGE };
    }

    throw error;
  }

  revalidatePath(SITES_PATH);

  return { ok: true };
}

// Each site is checked on its own, so some can be deleted while others are blocked.
export async function deleteSites(ids: string[]): Promise<SiteBulkDeleteResult> {
  await requireSuperadmin();

  const deletedIds: string[] = [];
  const blocked: SiteBulkDeleteResult["blocked"] = [];

  for (const id of ids) {
    const result = await softDeleteSite(id);

    if (result.ok) {
      deletedIds.push(id);
    } else {
      blocked.push({
        id,
        formError: result.formError ?? SITE_NOT_FOUND_MESSAGE,
      });
    }
  }

  if (deletedIds.length > 0) {
    revalidatePath(SITES_PATH);
  }

  return { deletedIds, blocked };
}
