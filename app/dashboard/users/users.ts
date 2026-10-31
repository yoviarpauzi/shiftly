import "server-only";
import { and, asc, count, eq, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { user } from "@/database/schema/auth-schema";
import { location } from "@/database/schema/location-schema";
import { db } from "@/lib/db";
import { clampPage, type UsersPageParams } from "./users-pagination";
import type { UserPage, UserScope } from "@/types/users";

const columns = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  banned: user.banned,
};

// Scope follows docs/DATABASE.md#access-model. Users with an empty role are only visible to superadmin.
function visibleUsersFilter(scope: UserScope): SQL | undefined {
  if (scope.role === "superadmin") {
    return undefined;
  }

  if (scope.role === "ho" && scope.siteId) {
    return and(
      isNotNull(user.role),
      or(eq(user.siteId, scope.siteId), eq(location.siteId, scope.siteId)),
    );
  }

  if (scope.role === "admin_site" && scope.locationId) {
    return and(isNotNull(user.role), eq(user.locationId, scope.locationId));
  }

  return sql`false`;
}

export async function listVisibleUsers(
  scope: UserScope,
  { page, pageSize }: UsersPageParams,
): Promise<UserPage> {
  const filter = visibleUsersFilter(scope);

  const [{ total }] = await db
    .select({ total: count() })
    .from(user)
    .leftJoin(location, eq(user.locationId, location.id))
    .where(filter);

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
