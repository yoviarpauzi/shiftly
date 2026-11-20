import "server-only";
import { and, asc, count, eq, ilike, isNull, ne, or, type SQL } from "drizzle-orm";
import { user } from "@/database/schema/auth-schema";
import { location } from "@/database/schema/location-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import type {
  UserAccess,
  UserChoices,
  UserListParams,
  UserPage,
  UserStatusFilter,
} from "@/types/users";

const columns = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  banned: user.banned,
  locationId: location.id,
  locationName: location.name,
};

// Matches name or email, case-insensitively. An empty query matches every row.
function searchUsersFilter(query: string): SQL | undefined {
  if (!query) {
    return undefined;
  }

  const pattern = `%${escapeLikePattern(query)}%`;

  return or(ilike(user.name, pattern), ilike(user.email, pattern));
}

// Active covers users with no ban flag set, so a null flag counts as active.
function userStatusFilter(status: UserStatusFilter): SQL | undefined {
  if (status === "active") {
    return or(eq(user.banned, false), isNull(user.banned));
  }

  return status === "banned" ? eq(user.banned, true) : undefined;
}

// HO sees every user except itself.
export async function listVisibleUsers(
  access: UserAccess,
  { page, pageSize, query, status, role, locationId }: UserListParams,
): Promise<UserPage> {
  const filter = and(
    ne(user.id, access.id),
    searchUsersFilter(query),
    userStatusFilter(status),
    role === "all" ? undefined : eq(user.role, role),
    locationId ? eq(user.locationId, locationId) : undefined,
  );

  const [{ total }] = await db.select({ total: count() }).from(user).where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select(columns)
    .from(user)
    .leftJoin(location, eq(user.locationId, location.id))
    .where(filter)
    .orderBy(asc(user.name), asc(user.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}

// Every active location.
export async function listUserChoices(): Promise<UserChoices> {
  const locations = await db
    .select({ id: location.id, name: location.name })
    .from(location)
    .where(isNull(location.deletedAt))
    .orderBy(asc(location.name), asc(location.id));

  return { locations };
}
