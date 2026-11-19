"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import {
  INVALID_TIMEZONE_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  siteCodeMissingMessage,
} from "@/app/dashboard/requests/request-rules";
import { poPeriod } from "@/app/dashboard/requests/po-number";
import { billing, billingAttendance, billingLine } from "@/database/schema/billing-schema";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import type { BillingAccess, BillingActionResult, BillingPeriod } from "@/types/billings";
import type { Transaction } from "@/types/requests";
import {
  createBillingSchema,
  deleteBillingSchema,
  issueBillingSchema,
  updateBillingPeriodSchema,
  voidBillingSchema,
  type CreateBillingInput,
  type DeleteBillingInput,
  type IssueBillingInput,
  type UpdateBillingPeriodInput,
  type VoidBillingInput,
} from "@/validation/billings";
import { locationTimezoneSchema } from "@/validation/location";
import { canManageBilling } from "./billing-access";
import { nextBillingSequence } from "./billing-counter";
import { requireBillingUser } from "./billing-guard";
import { formatBillingNumber } from "./billing-number";
import { periodFor } from "./billing-period";
import {
  BILLING_NOT_FOUND_MESSAGE,
  CLAIM_COLLISION_MESSAGE,
  groupBillableDays,
  isUniqueViolation,
  NOT_DRAFT_MESSAGE,
  NOT_ISSUED_MESSAGE,
  NOTHING_TO_BILL_MESSAGE,
  STALE_BILLING_MESSAGE,
} from "./billing-rules";
import { billingScopeFilter, loadBillableDays } from "./billings";

const BILLINGS_PATH = "/dashboard/billings";
const ATTENDANCE_PATH = "/dashboard/attendance";

// Each billed-day row takes 2 parameters, and Postgres allows 65,535 per statement.
const CLAIM_CHUNK_SIZE = 5000;

function invalid(issues: { message: string }[]): BillingActionResult {
  return { ok: false, formError: issues[0].message };
}

function revalidateBilling(id: string) {
  revalidatePath(BILLINGS_PATH);
  revalidatePath(`${BILLINGS_PATH}/${id}`);
}

// The billing row locked for update, so a concurrent edit, issue, or void waits for this one. A
// billing outside the caller's scope reads the same as a missing one.
async function lockBilling(tx: Transaction, access: BillingAccess, id: string) {
  const [row] = await tx
    .select({
      id: billing.id,
      status: billing.status,
      siteId: billing.siteId,
      locationId: billing.locationId,
      periodStart: billing.periodStart,
      periodEnd: billing.periodEnd,
      updatedAt: billing.updatedAt,
    })
    .from(billing)
    .where(and(eq(billing.id, id), billingScopeFilter(access)))
    .for("update");

  return row && canManageBilling(access, row) ? row : null;
}

// The version is the updatedAt the page loaded. Any write since then changes it.
function isStale(row: { updatedAt: Date }, version: string): boolean {
  return row.updatedAt.toISOString() !== version;
}

// The location and its site, share locked so neither can be deleted before the transaction ends.
async function lockLocation(tx: Transaction, locationId: string) {
  const [row] = await tx
    .select({
      id: location.id,
      siteId: location.siteId,
      siteName: site.name,
      siteCode: site.code,
      timezone: location.timezone,
    })
    .from(location)
    .innerJoin(site, eq(site.id, location.siteId))
    .where(and(eq(location.id, locationId), isNull(location.deletedAt), isNull(site.deletedAt)))
    .for("share");

  return row ?? null;
}

export async function createBilling(input: CreateBillingInput): Promise<BillingActionResult> {
  const { user, access } = await requireBillingUser();

  const parsed = createBillingSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const data = parsed.data;
  // The schema has already refused a period that periodFor cannot build.
  const period = periodFor(data.period) as BillingPeriod;

  const result = await db.transaction(async (tx): Promise<BillingActionResult> => {
    const target = await lockLocation(tx, data.locationId);

    // The site id comes from the location row, never from the client.
    if (!target || !canManageBilling(access, { locationId: target.id, siteId: target.siteId })) {
      return { ok: false, formError: LOCATION_NOT_FOUND_MESSAGE };
    }

    const [created] = await tx
      .insert(billing)
      .values({
        siteId: target.siteId,
        locationId: target.id,
        mode: data.period.mode,
        status: "draft",
        periodStart: period.from,
        periodEnd: period.to,
        createdBy: user.id,
      })
      .returning({ id: billing.id });

    return { ok: true, id: created.id };
  });

  if (result.ok) {
    revalidateBilling(result.id);
  }

  return result;
}

export async function updateBillingPeriod(
  input: UpdateBillingPeriodInput,
): Promise<BillingActionResult> {
  const { access } = await requireBillingUser();

  const parsed = updateBillingPeriodSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const data = parsed.data;
  const period = periodFor(data.period) as BillingPeriod;

  const result = await db.transaction(async (tx): Promise<BillingActionResult> => {
    const current = await lockBilling(tx, access, data.billingId);

    if (!current) {
      return { ok: false, formError: BILLING_NOT_FOUND_MESSAGE };
    }

    if (current.status !== "draft") {
      return { ok: false, formError: NOT_DRAFT_MESSAGE };
    }

    if (isStale(current, data.version)) {
      return { ok: false, formError: STALE_BILLING_MESSAGE };
    }

    await tx
      .update(billing)
      .set({ mode: data.period.mode, periodStart: period.from, periodEnd: period.to })
      .where(eq(billing.id, current.id));

    return { ok: true, id: current.id };
  });

  if (result.ok) {
    revalidateBilling(result.id);
  }

  return result;
}

// A draft has no lines and no claimed days, so deleting the row is all there is.
export async function deleteBilling(input: DeleteBillingInput): Promise<BillingActionResult> {
  const { access } = await requireBillingUser();

  const parsed = deleteBillingSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const result = await db.transaction(async (tx): Promise<BillingActionResult> => {
    const current = await lockBilling(tx, access, parsed.data.billingId);

    if (!current) {
      return { ok: false, formError: BILLING_NOT_FOUND_MESSAGE };
    }

    if (current.status !== "draft") {
      return { ok: false, formError: NOT_DRAFT_MESSAGE };
    }

    await tx.delete(billing).where(eq(billing.id, current.id));

    return { ok: true, id: current.id };
  });

  if (result.ok) {
    revalidateBilling(result.id);
  }

  return result;
}

// One transaction: the billing row, then the location and site, then the billable attendance rows
// are locked, so a concurrent attendance save or issue waits. The number is taken only once there
// is something to bill, and a failure after it rolls the number back with everything else.
export async function issueBilling(input: IssueBillingInput): Promise<BillingActionResult> {
  const { user, access } = await requireBillingUser();

  const parsed = issueBillingSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const data = parsed.data;
  let result: BillingActionResult;

  try {
    result = await db.transaction(async (tx): Promise<BillingActionResult> => {
      const current = await lockBilling(tx, access, data.billingId);

      if (!current) {
        return { ok: false, formError: BILLING_NOT_FOUND_MESSAGE };
      }

      if (current.status !== "draft") {
        return { ok: false, formError: NOT_DRAFT_MESSAGE };
      }

      if (isStale(current, data.version)) {
        return { ok: false, formError: STALE_BILLING_MESSAGE };
      }

      const target = await lockLocation(tx, current.locationId);

      if (!target) {
        return { ok: false, formError: LOCATION_NOT_FOUND_MESSAGE };
      }

      // The column is not checked by the database, so a hand edit can leave an unknown zone.
      const zone = locationTimezoneSchema.safeParse(target.timezone);

      if (!zone.success) {
        return { ok: false, formError: INVALID_TIMEZONE_MESSAGE };
      }

      if (!target.siteCode) {
        return { ok: false, formError: siteCodeMissingMessage(target.siteName) };
      }

      const days = await loadBillableDays(
        tx,
        current.locationId,
        { from: current.periodStart, to: current.periodEnd },
        { lock: true },
      );

      // Refused before the counter, so an empty period consumes no number.
      if (days.length === 0) {
        return { ok: false, formError: NOTHING_TO_BILL_MESSAGE };
      }

      const now = new Date();
      const period = poPeriod(now, zone.data);
      const sequence = await nextBillingSequence(tx, current.siteId, period);
      const number = formatBillingNumber(target.siteCode, period, sequence);

      // The names are copied, so the billing does not change when master data is renamed.
      const lines = groupBillableDays(days).pos.flatMap((po) =>
        po.lines.map((line) => ({ billingId: current.id, ...line })),
      );

      await tx.insert(billingLine).values(lines);

      // The primary key on attendance_id is the last guard against billing a day twice. Chunked,
      // so a long period stays under the Postgres limit on parameters per statement.
      for (let start = 0; start < days.length; start += CLAIM_CHUNK_SIZE) {
        await tx.insert(billingAttendance).values(
          days.slice(start, start + CLAIM_CHUNK_SIZE).map((day) => ({
            billingId: current.id,
            attendanceId: day.attendanceId,
          })),
        );
      }

      await tx
        .update(billing)
        .set({ status: "issued", number, issuedBy: user.id, issuedAt: now })
        .where(eq(billing.id, current.id));

      return { ok: true, id: current.id };
    });
  } catch (error) {
    // Caught outside the callback, so the transaction has already rolled back, number included.
    if (isUniqueViolation(error)) {
      return { ok: false, formError: CLAIM_COLLISION_MESSAGE };
    }

    throw error;
  }

  if (result.ok) {
    revalidateBilling(result.id);
    revalidatePath(ATTENDANCE_PATH);
  }

  return result;
}

// The lines stay as the record of what was billed. The claimed days are freed for another billing.
export async function voidBilling(input: VoidBillingInput): Promise<BillingActionResult> {
  const { user, access } = await requireBillingUser();

  const parsed = voidBillingSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const data = parsed.data;

  const result = await db.transaction(async (tx): Promise<BillingActionResult> => {
    const current = await lockBilling(tx, access, data.billingId);

    if (!current) {
      return { ok: false, formError: BILLING_NOT_FOUND_MESSAGE };
    }

    if (current.status !== "issued") {
      return { ok: false, formError: NOT_ISSUED_MESSAGE };
    }

    if (isStale(current, data.version)) {
      return { ok: false, formError: STALE_BILLING_MESSAGE };
    }

    await tx.delete(billingAttendance).where(eq(billingAttendance.billingId, current.id));

    await tx
      .update(billing)
      .set({ status: "void", voidedBy: user.id, voidedAt: new Date(), voidReason: data.reason })
      .where(eq(billing.id, current.id));

    return { ok: true, id: current.id };
  });

  if (result.ok) {
    revalidateBilling(result.id);
    revalidatePath(ATTENDANCE_PATH);
  }

  return result;
}
