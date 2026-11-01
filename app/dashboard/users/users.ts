import "server-only";
import { and, asc, count, eq, ilike, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { user } from "@/database/schema/auth-schema";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import type {
  UserAccess,
  UserChoices,
  UserListParams,
  UserPage,
  UserScope,
  UserStatusFilter,
} from "@/types/users";

const columns = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  banned: user.banned,
  siteId: site.id,
  siteName: site.name,
  locationId: location.id,
  locationName: location.name,
};

// An admin site user takes the site of its location, never its own site_id. Every other role
// falls back from its own site_id to its location's site.
const userSiteId = sql`case when ${user.role} = 'admin_site' then ${location.siteId} else coalesce(${user.siteId}, ${location.siteId}) end`;

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

export async function listVisibleUsers(
  scope: UserScope,
  { page, pageSize, query, status, role, siteId, locationId }: UserListParams,
): Promise<UserPage> {
  // The signed-in user's own account is not listed here.
  const filter = and(
    visibleUsersFilter(scope),
    ne(user.id, scope.id),
    searchUsersFilter(query),
    userStatusFilter(status),
    role === "all" ? undefined : eq(user.role, role),
    siteId ? eq(userSiteId, siteId) : undefined,
    locationId ? eq(user.locationId, locationId) : undefined,
  );

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
    .leftJoin(site, eq(site.id, userSiteId))
    .where(filter)
    .orderBy(asc(user.name), asc(user.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}

// Superadmin picks from every active site and location. HO gets its own site and the active
// locations in it.
export async function listUserChoices(access: UserAccess): Promise<UserChoices> {
  const siteFilter = and(
    isNull(site.deletedAt),
    access.siteId ? eq(site.id, access.siteId) : undefined,
  );
  const locationFilter = and(
    isNull(location.deletedAt),
    isNull(site.deletedAt),
    access.siteId ? eq(location.siteId, access.siteId) : undefined,
  );

  const [sites, locations] = await Promise.all([
    db
      .select({ id: site.id, name: site.name })
      .from(site)
      .where(siteFilter)
      .orderBy(asc(site.name), asc(site.id)),
    db
      .select({
        id: location.id,
        name: location.name,
        siteId: location.siteId,
        siteName: site.name,
      })
      .from(location)
      .innerJoin(site, eq(site.id, location.siteId))
      .where(locationFilter)
      .orderBy(asc(location.name), asc(location.id)),
  ]);

  return { sites, locations };
}
