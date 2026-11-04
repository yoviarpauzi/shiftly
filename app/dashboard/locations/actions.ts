"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { user } from "@/database/schema/auth-schema";
import { department } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { shift } from "@/database/schema/shift-schema";
import { worker } from "@/database/schema/worker-schema";
import { isUniqueViolation } from "@/error/db-error";
import { db } from "@/lib/db";
import { resolveSiteId } from "./location-access";
import { requireLocationManager } from "./location-guard";
import type {
  LocationAccess,
  LocationActionResult,
  LocationBulkDeleteResult,
  LocationBulkRestoreResult,
} from "@/types/locations";
import { locationSchema, type LocationInput } from "@/validation/location";
import { locationScopeFilter } from "./locations";
import {
  canDeleteLocation,
  DUPLICATE_NAME_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  locationFieldErrors,
  RESTORE_CONFLICT_MESSAGE,
} from "./location-rules";

const LOCATIONS_PATH = "/dashboard/locations";

export async function createLocation(input: LocationInput): Promise<LocationActionResult> {
  const access = await requireLocationManager();

  const parsed = locationSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: locationFieldErrors(parsed.error.issues) };
  }

  try {
    await db.insert(location).values({
      name: parsed.data.name,
      siteId: resolveSiteId(access, parsed.data.siteId),
      timezone: parsed.data.timezone,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, fieldErrors: { name: DUPLICATE_NAME_MESSAGE } };
    }

    throw error;
  }

  revalidatePath(LOCATIONS_PATH);

  return { ok: true };
}

export async function updateLocation(
  id: string,
  input: LocationInput,
): Promise<LocationActionResult> {
  const access = await requireLocationManager();

  const parsed = locationSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: locationFieldErrors(parsed.error.issues) };
  }

  try {
    const updated = await db
      .update(location)
      .set({
        name: parsed.data.name,
        siteId: resolveSiteId(access, parsed.data.siteId),
        timezone: parsed.data.timezone,
      })
      .where(
        and(
          eq(location.id, id),
          isNull(location.deletedAt),
          locationScopeFilter(access),
        ),
      )
      .returning({ id: location.id });

    if (updated.length === 0) {
      return { ok: false, formError: LOCATION_NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, fieldErrors: { name: DUPLICATE_NAME_MESSAGE } };
    }

    throw error;
  }

  revalidatePath(LOCATIONS_PATH);

  return { ok: true };
}

// Checks and soft-deletes one location. The caller has already passed requireLocationManager().
async function softDeleteLocation(
  id: string,
  access: LocationAccess,
): Promise<LocationActionResult> {
  // The row lock stops a user from being assigned to this location until the checks have run.
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: location.id })
      .from(location)
      .where(
        and(
          eq(location.id, id),
          isNull(location.deletedAt),
          locationScopeFilter(access),
        ),
      )
      .for("update");

    if (!target) {
      return { ok: false as const, formError: LOCATION_NOT_FOUND_MESSAGE };
    }

    const [{ value: assignedAdminSites }] = await tx
      .select({ value: count() })
      .from(user)
      .where(and(eq(user.locationId, id), eq(user.role, "admin_site")));

    const [{ value: activeDepartments }] = await tx
      .select({ value: count() })
      .from(department)
      .where(and(eq(department.locationId, id), isNull(department.deletedAt)));

    const [{ value: activeWorkers }] = await tx
      .select({ value: count() })
      .from(worker)
      .where(and(eq(worker.locationId, id), isNull(worker.deletedAt)));

    const [{ value: activeShifts }] = await tx
      .select({ value: count() })
      .from(shift)
      .where(and(eq(shift.locationId, id), isNull(shift.deletedAt)));

    const verdict = canDeleteLocation({
      assignedAdminSites,
      activeDepartments,
      activeWorkers,
      activeShifts,
    });

    if (!verdict.ok) {
      return { ok: false as const, formError: verdict.formError };
    }

    await tx
      .update(location)
      .set({ deletedAt: new Date() })
      .where(eq(location.id, id));

    return { ok: true as const };
  });
}

export async function deleteLocation(id: string): Promise<LocationActionResult> {
  const access = await requireLocationManager();

  const result = await softDeleteLocation(id, access);

  if (result.ok) {
    revalidatePath(LOCATIONS_PATH);
  }

  return result;
}

// Restores one location. The caller has already passed requireLocationManager().
async function restoreOne(id: string, access: LocationAccess): Promise<LocationActionResult> {
  try {
    const restored = await db
      .update(location)
      .set({ deletedAt: null })
      .where(
        and(
          eq(location.id, id),
          isNotNull(location.deletedAt),
          locationScopeFilter(access),
        ),
      )
      .returning({ id: location.id });

    if (restored.length === 0) {
      return { ok: false, formError: LOCATION_NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, formError: RESTORE_CONFLICT_MESSAGE };
    }

    throw error;
  }

  return { ok: true };
}

export async function restoreLocation(id: string): Promise<LocationActionResult> {
  const access = await requireLocationManager();

  const result = await restoreOne(id, access);

  if (result.ok) {
    revalidatePath(LOCATIONS_PATH);
  }

  return result;
}

// Each location is checked on its own, so some can be deleted while others are blocked.
export async function deleteLocations(ids: string[]): Promise<LocationBulkDeleteResult> {
  const access = await requireLocationManager();

  const deletedIds: string[] = [];
  const blocked: LocationBulkDeleteResult["blocked"] = [];

  for (const id of ids) {
    const result = await softDeleteLocation(id, access);

    if (result.ok) {
      deletedIds.push(id);
    } else {
      blocked.push({
        id,
        formError: result.formError ?? LOCATION_NOT_FOUND_MESSAGE,
      });
    }
  }

  if (deletedIds.length > 0) {
    revalidatePath(LOCATIONS_PATH);
  }

  return { deletedIds, blocked };
}

// Each location is checked on its own, so some can be restored while others are blocked by a name conflict.
export async function restoreLocations(ids: string[]): Promise<LocationBulkRestoreResult> {
  const access = await requireLocationManager();

  const restoredIds: string[] = [];
  const blocked: LocationBulkRestoreResult["blocked"] = [];

  for (const id of ids) {
    const result = await restoreOne(id, access);

    if (result.ok) {
      restoredIds.push(id);
    } else {
      blocked.push({
        id,
        formError: result.formError ?? LOCATION_NOT_FOUND_MESSAGE,
      });
    }
  }

  if (restoredIds.length > 0) {
    revalidatePath(LOCATIONS_PATH);
  }

  return { restoredIds, blocked };
}
