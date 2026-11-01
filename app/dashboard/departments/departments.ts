import "server-only";
import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { notFound } from "next/navigation";
import { department, subDepartment } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type {
  DepartmentAccess,
  DepartmentListParams,
  DepartmentLocationChoice,
  DepartmentPage,
  DepartmentRow,
  DepartmentSortColumn,
  DepartmentStatus,
  SubDepartmentListParams,
  SubDepartmentPage,
  SubDepartmentSortColumn,
} from "@/types/departments";
import type { SortCriterion } from "@/types/sort";

const DEFAULT_SORT: SortCriterion<DepartmentSortColumn>[] = [
  { column: "location", direction: "asc" },
  { column: "name", direction: "asc" },
];

// Each sortable column maps to a fixed expression. URL input only picks a key from this map.
const DEPARTMENT_SORT_EXPRESSIONS: Record<DepartmentSortColumn, SQLWrapper> = {
  name: department.name,
  location: location.name,
  status: sql`(${department.deletedAt} is not null)`,
};

const SUB_DEPARTMENT_DEFAULT_SORT: SortCriterion<SubDepartmentSortColumn>[] = [
  { column: "name", direction: "asc" },
];

const SUB_DEPARTMENT_SORT_EXPRESSIONS: Record<SubDepartmentSortColumn, SQLWrapper> = {
  name: subDepartment.name,
  status: sql`(${subDepartment.deletedAt} is not null)`,
};

// Superadmin sees every department. Admin site sees its own location. HO sees the locations of its own site.
export function departmentScopeFilter(access: DepartmentAccess): SQL | undefined {
  if (access.locationId) {
    return eq(department.locationId, access.locationId);
  }

  if (access.siteId) {
    return inArray(
      department.locationId,
      db.select({ id: location.id }).from(location).where(eq(location.siteId, access.siteId)),
    );
  }

  return undefined;
}

// Matches name case-insensitively. An empty query matches every department in the status.
function departmentFilter(
  access: DepartmentAccess,
  query: string,
  status: DepartmentStatus,
  locationId: string | null,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    departmentScopeFilter(access),
    locationId ? eq(department.locationId, locationId) : undefined,
    status === "active" ? isNull(department.deletedAt) : undefined,
    status === "deleted" ? isNotNull(department.deletedAt) : undefined,
    query ? ilike(department.name, pattern) : undefined,
  );
}

export async function listDepartments(
  access: DepartmentAccess,
  { page, pageSize, query, status, locationId, sort }: DepartmentListParams,
): Promise<DepartmentPage> {
  const filter = departmentFilter(access, query, status, locationId);
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

  // Counted from the department table alone, so the location join does not inflate the total.
  const [{ total }] = await db
    .select({ total: count() })
    .from(department)
    .where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select({
      id: department.id,
      name: department.name,
      locationId: department.locationId,
      locationName: location.name,
      // A correlated subquery, not a join, so it adds no rows. Active sub-departments only.
      subDepartmentCount: sql<number>`(
        select count(*)::int from ${subDepartment}
        where ${subDepartment.departmentId} = ${department.id}
        and ${subDepartment.deletedAt} is null
      )`,
      deletedAt: department.deletedAt,
    })
    .from(department)
    .innerJoin(location, eq(location.id, department.locationId))
    .where(filter)
    .orderBy(...sortTerms(criteria, DEPARTMENT_SORT_EXPRESSIONS), asc(department.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}

// Admin site gets its own location as fixed text. HO and superadmin pick from the active locations they can see.
export async function departmentLocationChoiceFor(
  access: DepartmentAccess,
): Promise<DepartmentLocationChoice> {
  if (access.locationId) {
    const [own] = await db
      .select({ id: location.id, name: location.name, siteName: site.name })
      .from(location)
      .innerJoin(site, eq(site.id, location.siteId))
      .where(and(eq(location.id, access.locationId), isNull(location.deletedAt)));

    if (!own) {
      notFound();
    }

    return { mode: "fixed", location: own };
  }

  const locations = await db
    .select({ id: location.id, name: location.name, siteName: site.name })
    .from(location)
    .innerJoin(site, eq(site.id, location.siteId))
    .where(
      and(
        isNull(location.deletedAt),
        access.siteId ? eq(location.siteId, access.siteId) : undefined,
      ),
    )
    .orderBy(asc(site.name), asc(location.name), asc(location.id));

  return { mode: "pick", locations };
}

// The row that canWriteToLocation checks. A deleted location is not a valid target for a write.
export async function findLocationForWrite(
  locationId: string,
): Promise<{ id: string; siteId: string } | undefined> {
  const [row] = await db
    .select({ id: location.id, siteId: location.siteId })
    .from(location)
    .where(and(eq(location.id, locationId), isNull(location.deletedAt)));

  return row;
}

// Scoped and active only, so a deleted or out-of-scope department reads as missing.
export async function getDepartment(
  access: DepartmentAccess,
  id: string,
): Promise<DepartmentRow | undefined> {
  const [row] = await db
    .select({
      id: department.id,
      name: department.name,
      locationId: department.locationId,
      locationName: location.name,
      subDepartmentCount: sql<number>`(
        select count(*)::int from ${subDepartment}
        where ${subDepartment.departmentId} = ${department.id}
        and ${subDepartment.deletedAt} is null
      )`,
      deletedAt: department.deletedAt,
    })
    .from(department)
    .innerJoin(location, eq(location.id, department.locationId))
    .where(and(eq(department.id, id), isNull(department.deletedAt), departmentScopeFilter(access)));

  return row;
}

// Matches name case-insensitively. An empty query matches every sub-department in the status.
// The scope sits on the department side of the join, so an out-of-scope parent yields no rows.
function subDepartmentFilter(
  access: DepartmentAccess,
  departmentId: string,
  query: string,
  status: DepartmentStatus,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    eq(subDepartment.departmentId, departmentId),
    departmentScopeFilter(access),
    status === "active" ? isNull(subDepartment.deletedAt) : undefined,
    status === "deleted" ? isNotNull(subDepartment.deletedAt) : undefined,
    query ? ilike(subDepartment.name, pattern) : undefined,
  );
}

// One page of the department's sub-departments, scoped by the access the caller holds.
export async function listSubDepartments(
  access: DepartmentAccess,
  departmentId: string,
  { page, pageSize, query, status, sort }: SubDepartmentListParams,
): Promise<SubDepartmentPage> {
  const filter = subDepartmentFilter(access, departmentId, query, status);
  const criteria = sort.length > 0 ? sort : SUB_DEPARTMENT_DEFAULT_SORT;

  // Counted from the sub-department table. The join to department is one-to-one, so it does not inflate the total.
  const [{ total }] = await db
    .select({ total: count() })
    .from(subDepartment)
    .innerJoin(department, eq(department.id, subDepartment.departmentId))
    .where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select({
      id: subDepartment.id,
      name: subDepartment.name,
      departmentId: subDepartment.departmentId,
      deletedAt: subDepartment.deletedAt,
    })
    .from(subDepartment)
    .innerJoin(department, eq(department.id, subDepartment.departmentId))
    .where(filter)
    .orderBy(...sortTerms(criteria, SUB_DEPARTMENT_SORT_EXPRESSIONS), asc(subDepartment.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}
