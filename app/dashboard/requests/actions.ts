"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { department, subDepartment } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { rosterRequest, rosterRequestLine } from "@/database/schema/request-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { jakartaDate } from "@/lib/indonesia-date";
import type {
  RequestAccess,
  RequestActionResult,
  RequestActor,
  RequestLineInput,
  RequestType,
  RequestStatus,
  Transaction,
} from "@/types/requests";
import {
  createRequestSchema,
  updateRequestSchema,
  type RequestInput,
  type RequestUpdateInput,
} from "@/validation/request";
import { parseRequestId } from "@/validation/request-id";
import { nextPoSequence } from "./po-counter";
import { formatPoNumber, poPeriod } from "./po-number";
import { canDecideRequest, canWriteToLocation } from "./request-access";
import { requireRequestUser } from "./request-guard";
import {
  initialStatus,
  LOCATION_NOT_FOUND_MESSAGE,
  lineScopeError,
  NOT_CANCELLABLE_MESSAGE,
  NOT_EDITABLE_MESSAGE,
  NOT_PENDING_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  REQUEST_NOT_FOUND_MESSAGE,
  requestFieldErrors,
  siteCodeMissingMessage,
  statusAfterEdit,
} from "./request-rules";
import { requestScopeFilter } from "./requests";

const REQUESTS_PATH = "/dashboard/requests";

const REASON_MAX_LENGTH = 500;

function revalidateRequest(id: string) {
  revalidatePath(REQUESTS_PATH);
  revalidatePath(`${REQUESTS_PATH}/${id}`);
}

// The active departments of the location with their active sub-departments, and the active
// positions of the site, in the shape lineScopeError checks against.
async function lineChoices(tx: Transaction, locationId: string, siteId: string) {
  const departments = await tx
    .select({ id: department.id })
    .from(department)
    .where(and(eq(department.locationId, locationId), isNull(department.deletedAt)));

  const subDepartments = await tx
    .select({ id: subDepartment.id, departmentId: subDepartment.departmentId })
    .from(subDepartment)
    .innerJoin(department, eq(department.id, subDepartment.departmentId))
    .where(
      and(
        eq(department.locationId, locationId),
        isNull(department.deletedAt),
        isNull(subDepartment.deletedAt),
      ),
    );

  const positions = await tx
    .select({ id: position.id })
    .from(position)
    .where(and(eq(position.siteId, siteId), isNull(position.deletedAt)));

  const departmentMap = new Map<string, Set<string>>(
    departments.map((row) => [row.id, new Set<string>()]),
  );

  for (const row of subDepartments) {
    departmentMap.get(row.departmentId)?.add(row.id);
  }

  return {
    departments: departmentMap,
    positionIds: new Set(positions.map((row) => row.id)),
  };
}

function lineRows(requestId: string, lines: RequestLineInput[]) {
  return lines.map((line) => ({
    requestId,
    departmentId: line.departmentId,
    subDepartmentId: line.subDepartmentId,
    positionId: line.positionId,
    headcount: line.headcount,
  }));
}

export async function createRequest(input: RequestInput): Promise<RequestActionResult> {
  const { user, access } = await requireRequestUser();

  const parsed = createRequestSchema(jakartaDate()).safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: requestFieldErrors(parsed.error.issues) };
  }

  const data = parsed.data;

  // The share lock conflicts with the update lock a location or site delete takes, so neither can
  // be deleted between this check and the insert. The location id comes from the client, so it is
  // loaded and checked against the caller's access, and the site id is taken from the row.
  const result = await db.transaction(async (tx): Promise<RequestActionResult> => {
    const [target] = await tx
      .select({
        id: location.id,
        siteId: location.siteId,
        siteName: site.name,
        siteCode: site.code,
      })
      .from(location)
      .innerJoin(site, eq(site.id, location.siteId))
      .where(
        and(eq(location.id, data.locationId), isNull(location.deletedAt), isNull(site.deletedAt)),
      )
      .for("share");

    if (!target || !canWriteToLocation(access, { id: target.id, siteId: target.siteId })) {
      return { ok: false, formError: LOCATION_NOT_FOUND_MESSAGE };
    }

    if (!target.siteCode) {
      return { ok: false, formError: siteCodeMissingMessage(target.siteName) };
    }

    const lineError = lineScopeError(
      data.lines,
      await lineChoices(tx, target.id, target.siteId),
    );

    if (lineError) {
      return { ok: false, fieldErrors: { lines: lineError } };
    }

    // Issued inside this transaction, so a failed insert rolls the number back with it.
    const period = poPeriod(new Date());
    const sequence = await nextPoSequence(tx, target.siteId, period);
    const poNumber = formatPoNumber(target.siteCode, period, sequence);

    const [created] = await tx
      .insert(rosterRequest)
      .values({
        poNumber,
        type: data.type,
        startDate: data.startDate,
        siteId: target.siteId,
        locationId: target.id,
        status: initialStatus(data.type),
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: rosterRequest.id });

    await tx.insert(rosterRequestLine).values(lineRows(created.id, data.lines));

    return { ok: true, id: created.id, poNumber };
  });

  if (result.ok) {
    revalidatePath(REQUESTS_PATH);
  }

  return result;
}

// Start date and lines change. Type and location are fixed after creation.
export async function updateRequest(
  id: string,
  input: RequestUpdateInput,
): Promise<RequestActionResult> {
  const { user, access } = await requireRequestUser();

  // A malformed id would make Postgres throw, so it is refused before any query.
  if (!parseRequestId(id)) {
    return { ok: false, formError: REQUEST_NOT_FOUND_MESSAGE };
  }

  const result = await db.transaction(async (tx): Promise<RequestActionResult> => {
    // The row lock makes a concurrent approve, reject, or cancel wait, so the status read here is
    // still the status when the edit commits.
    const [current] = await tx
      .select({
        id: rosterRequest.id,
        type: rosterRequest.type,
        status: rosterRequest.status,
        startDate: rosterRequest.startDate,
        siteId: rosterRequest.siteId,
        locationId: rosterRequest.locationId,
      })
      .from(rosterRequest)
      .where(and(eq(rosterRequest.id, id), requestScopeFilter(access)))
      .for("update");

    if (!current) {
      return { ok: false, formError: REQUEST_NOT_FOUND_MESSAGE };
    }

    const currentStatus = current.status as RequestStatus;
    const nextStatus = statusAfterEdit(current.type as RequestType, currentStatus);

    if (nextStatus === null) {
      return { ok: false, formError: NOT_EDITABLE_MESSAGE };
    }

    // A stored date that has since passed may be kept. Only a new date must not be in the past.
    const minDate = input?.startDate !== current.startDate ? jakartaDate() : null;
    const parsed = updateRequestSchema(minDate).safeParse(input);

    if (!parsed.success) {
      return { ok: false, fieldErrors: requestFieldErrors(parsed.error.issues) };
    }

    const data = parsed.data;

    const lineError = lineScopeError(
      data.lines,
      await lineChoices(tx, current.locationId, current.siteId),
    );

    if (lineError) {
      return { ok: false, fieldErrors: { lines: lineError } };
    }

    // An approved weekly request goes back to pending, so its old decision no longer applies.
    const clearsDecision = currentStatus === "approved" && nextStatus === "pending";

    await tx
      .update(rosterRequest)
      .set({
        startDate: data.startDate,
        status: nextStatus,
        updatedBy: user.id,
        ...(clearsDecision ? { decidedBy: null, decidedAt: null, rejectReason: null } : {}),
      })
      .where(eq(rosterRequest.id, current.id));

    await tx.delete(rosterRequestLine).where(eq(rosterRequestLine.requestId, current.id));
    await tx.insert(rosterRequestLine).values(lineRows(current.id, data.lines));

    return { ok: true };
  });

  if (result.ok) {
    revalidateRequest(id);
  }

  return result;
}

// The scoped read tells a missing or hidden request apart from one in the wrong status. An id that
// is not a uuid is the same as a missing one, and never reaches the database.
async function findScopedRequest(access: RequestAccess, id: string) {
  if (!parseRequestId(id)) {
    return null;
  }

  const [row] = await db
    .select({ id: rosterRequest.id, siteId: rosterRequest.siteId })
    .from(rosterRequest)
    .where(and(eq(rosterRequest.id, id), requestScopeFilter(access)));

  return row ?? null;
}

export async function cancelRequest(id: string): Promise<RequestActionResult> {
  const { user, access } = await requireRequestUser();

  if (!(await findScopedRequest(access, id))) {
    return { ok: false, formError: REQUEST_NOT_FOUND_MESSAGE };
  }

  // The status check sits in the UPDATE itself, so a concurrent change cannot slip in between.
  const cancelled = await db
    .update(rosterRequest)
    .set({ status: "cancelled", updatedBy: user.id })
    .where(
      and(
        eq(rosterRequest.id, id),
        requestScopeFilter(access),
        inArray(rosterRequest.status, ["pending", "approved"]),
      ),
    )
    .returning({ id: rosterRequest.id });

  if (cancelled.length === 0) {
    return { ok: false, formError: NOT_CANCELLABLE_MESSAGE };
  }

  revalidateRequest(id);

  return { ok: true };
}

// Approve and reject share this path. A caller who may not decide gets the same result as a
// request outside the scope. Only a pending request changes, which also settles two HO users
// deciding at once: the second UPDATE matches no row.
async function decideRequest(
  user: RequestActor,
  access: RequestAccess,
  id: string,
  decision: { status: "approved"; rejectReason: null } | { status: "rejected"; rejectReason: string },
): Promise<RequestActionResult> {
  const target = await findScopedRequest(access, id);

  if (!target || !canDecideRequest(user, { siteId: target.siteId })) {
    return { ok: false, formError: REQUEST_NOT_FOUND_MESSAGE };
  }

  const decided = await db
    .update(rosterRequest)
    .set({
      ...decision,
      decidedBy: user.id,
      decidedAt: new Date(),
      updatedBy: user.id,
    })
    .where(
      and(
        eq(rosterRequest.id, id),
        requestScopeFilter(access),
        eq(rosterRequest.status, "pending"),
      ),
    )
    .returning({ id: rosterRequest.id });

  if (decided.length === 0) {
    return { ok: false, formError: NOT_PENDING_MESSAGE };
  }

  revalidateRequest(id);

  return { ok: true };
}

export async function approveRequest(id: string): Promise<RequestActionResult> {
  const { user, access } = await requireRequestUser();

  return decideRequest(user, access, id, { status: "approved", rejectReason: null });
}

export async function rejectRequest(id: string, reason: string): Promise<RequestActionResult> {
  const { user, access } = await requireRequestUser();

  const trimmed = typeof reason === "string" ? reason.trim() : "";

  if (trimmed.length === 0 || trimmed.length > REASON_MAX_LENGTH) {
    return { ok: false, formError: REASON_REQUIRED_MESSAGE };
  }

  return decideRequest(user, access, id, { status: "rejected", rejectReason: trimmed });
}
