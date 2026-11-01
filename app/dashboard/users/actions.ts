"use server";

import "server-only";
import { hashPassword } from "better-auth/crypto";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { account, session, user } from "@/database/schema/auth-schema";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { isUniqueViolation } from "@/error/db-error";
import { db } from "@/lib/db";
import { requireUserManager } from "@/lib/session";
import { assignableRoles, canAssign, canManageUser } from "@/lib/user-access";
import {
  guardDeactivation,
  guardRoleChange,
  LOCATION_OUT_OF_SCOPE_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from "@/lib/user-rules";
import type { AppRole } from "@/types/roles";
import type { ManagedTarget, UserAccess, UserActionResult, UserField } from "@/types/users";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/validation/users";

const USERS_PATH = "/dashboard/users";
const EMAIL_TAKEN_MESSAGE = "This email is already used by another account";
const USER_FIELDS: readonly string[] = ["name", "email", "password", "role", "siteId", "locationId"];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type Scope = { role: AppRole; siteId: string | null; locationId: string | null };

const userNotFound: UserActionResult = { ok: false, formError: USER_NOT_FOUND_MESSAGE };
const emailTaken: UserActionResult = { ok: false, fieldErrors: { email: EMAIL_TAKEN_MESSAGE } };

function invalidInput(error: ZodError): UserActionResult {
  const issue = error.issues[0];
  const field = issue.path[0];

  if (typeof field === "string" && USER_FIELDS.includes(field)) {
    return { ok: false, fieldErrors: { [field as UserField]: issue.message } };
  }

  return { ok: false, formError: issue.message };
}

// Locks every active superadmin row in id order and returns how many there are. Actions take this
// lock before loadTarget, so two superadmins removing each other queue here instead of both
// seeing a count of two. Postgres does not allow count() with FOR UPDATE, so rows are counted here.
async function lockActiveSuperadmins(tx: Tx): Promise<number> {
  const rows = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "superadmin"), or(isNull(user.banned), eq(user.banned, false))))
    .orderBy(asc(user.id))
    .for("update");

  return rows.length;
}

// locationSiteId comes from the target's location, never from its own site_id.
async function loadTarget(tx: Tx, id: string): Promise<ManagedTarget | null> {
  const [row] = await tx
    .select({
      id: user.id,
      role: user.role,
      siteId: user.siteId,
      locationSiteId: location.siteId,
      banned: user.banned,
    })
    .from(user)
    .leftJoin(location, eq(user.locationId, location.id))
    .where(eq(user.id, id))
    .for("update", { of: user });

  return row ? { ...row, banned: row.banned ?? false } : null;
}

// Checks the chosen role, site, and location against the caller's scope and returns the columns to
// write. The site or location row is share-locked so it cannot be deleted before the write commits.
async function resolveScope(
  tx: Tx,
  access: UserAccess,
  input: Scope,
): Promise<{ ok: true; scope: Scope } | { ok: false; result: UserActionResult }> {
  const { role } = input;

  if (!assignableRoles(access).includes(role)) {
    return { ok: false, result: { ok: false, fieldErrors: { role: "Choose a role" } } };
  }

  if (role === "admin_site") {
    const locationId = input.locationId ?? "";
    const [chosen] = await tx
      .select({ siteId: location.siteId })
      .from(location)
      .where(and(eq(location.id, locationId), isNull(location.deletedAt)))
      .for("share");

    if (!canAssign(access, { role }, chosen?.siteId ?? null)) {
      return {
        ok: false,
        result: { ok: false, fieldErrors: { locationId: LOCATION_OUT_OF_SCOPE_MESSAGE } },
      };
    }

    if (!chosen) {
      return { ok: false, result: { ok: false, fieldErrors: { locationId: "Choose a location" } } };
    }

    // An admin site user takes its site from its location, so site_id is always written as null.
    return { ok: true, scope: { role, siteId: null, locationId } };
  }

  if (!canAssign(access, { role }, null)) {
    return { ok: false, result: { ok: false, fieldErrors: { role: "Choose a role" } } };
  }

  if (role === "ho") {
    const siteId = input.siteId ?? "";
    const [chosen] = await tx
      .select({ id: site.id })
      .from(site)
      .where(and(eq(site.id, siteId), isNull(site.deletedAt)))
      .for("share");

    if (!chosen) {
      return { ok: false, result: { ok: false, fieldErrors: { siteId: "Choose a site" } } };
    }

    return { ok: true, scope: { role, siteId, locationId: null } };
  }

  return { ok: true, scope: { role, siteId: null, locationId: null } };
}

export async function createUser(input: CreateUserInput): Promise<UserActionResult> {
  const access = await requireUserManager();

  const parsed = createUserSchema.safeParse(input);

  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const { name, email, password } = parsed.data;
  // Hashed before the transaction so the locks are not held while scrypt runs.
  const passwordHash = await hashPassword(password);

  let result: UserActionResult;

  try {
    result = await db.transaction(async (tx) => {
      const resolved = await resolveScope(tx, access, parsed.data);

      if (!resolved.ok) {
        return resolved.result;
      }

      const id = crypto.randomUUID();

      await tx.insert(user).values({
        id,
        name,
        email,
        emailVerified: false,
        banned: false,
        ...resolved.scope,
      });

      await tx.insert(account).values({
        id: crypto.randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: passwordHash,
      });

      return { ok: true };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return emailTaken;
    }

    throw error;
  }

  if (result.ok) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserActionResult> {
  const access = await requireUserManager();

  const parsed = updateUserSchema.safeParse(input);

  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const { name, email, password } = parsed.data;
  // An empty password was turned into undefined by the schema and keeps the current one.
  const passwordHash = password ? await hashPassword(password) : null;

  let result: UserActionResult;

  try {
    result = await db.transaction(async (tx) => {
      const activeSuperadmins = await lockActiveSuperadmins(tx);
      const target = await loadTarget(tx, id);

      if (!target || !canManageUser(access, target)) {
        return userNotFound;
      }

      const refusal = guardRoleChange(access, target, parsed.data.role, activeSuperadmins);

      if (refusal) {
        return { ok: false, formError: refusal };
      }

      const resolved = await resolveScope(tx, access, parsed.data);

      if (!resolved.ok) {
        return resolved.result;
      }

      await tx
        .update(user)
        .set({ name, email, ...resolved.scope })
        .where(eq(user.id, id));

      if (passwordHash) {
        const updated = await tx
          .update(account)
          .set({ password: passwordHash })
          .where(and(eq(account.userId, id), eq(account.providerId, "credential")))
          .returning({ id: account.id });

        if (updated.length === 0) {
          await tx.insert(account).values({
            id: crypto.randomUUID(),
            accountId: id,
            providerId: "credential",
            userId: id,
            password: passwordHash,
          });
        }

        // A changed password signs the user out everywhere.
        await tx.delete(session).where(eq(session.userId, id));
      }

      return { ok: true };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return emailTaken;
    }

    throw error;
  }

  if (result.ok) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

export async function deactivateUser(id: string): Promise<UserActionResult> {
  const access = await requireUserManager();

  const result = await db.transaction(async (tx): Promise<UserActionResult> => {
    const activeSuperadmins = await lockActiveSuperadmins(tx);
    const target = await loadTarget(tx, id);

    if (!target || !canManageUser(access, target)) {
      return userNotFound;
    }

    const refusal = guardDeactivation(access, target, activeSuperadmins);

    if (refusal) {
      return { ok: false, formError: refusal };
    }

    // A null ban_expires makes the ban permanent. better-auth lifts a ban once ban_expires passes.
    await tx.update(user).set({ banned: true, banExpires: null }).where(eq(user.id, id));
    await tx.delete(session).where(eq(session.userId, id));

    return { ok: true };
  });

  if (result.ok) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

// Sessions deleted on deactivation are not restored. The user signs in again.
export async function reactivateUser(id: string): Promise<UserActionResult> {
  const access = await requireUserManager();

  const result = await db.transaction(async (tx): Promise<UserActionResult> => {
    const target = await loadTarget(tx, id);

    if (!target || !canManageUser(access, target)) {
      return userNotFound;
    }

    await tx
      .update(user)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(user.id, id));

    return { ok: true };
  });

  if (result.ok) {
    revalidatePath(USERS_PATH);
  }

  return result;
}
