import "server-only";
import {
  and,
  asc,
  count,
  ilike,
  isNotNull,
  isNull,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { location } from "@/database/schema/location-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type { SortCriterion } from "@/types/sort";
import type {
  LocationListParams,
  LocationPage,
  LocationSortColumn,
  LocationStatus,
} from "@/types/locations";

const DEFAULT_SORT: SortCriterion<LocationSortColumn>[] = [{ column: "name", direction: "asc" }];

// Each sortable column maps to a fixed expression. URL input only picks a key from this map.
const LOCATION_SORT_EXPRESSIONS: Record<LocationSortColumn, SQLWrapper> = {
  name: location.name,
  status: sql`(${location.deletedAt} is not null)`,
};

// Matches name case-insensitively. An empty query matches every location in the status.
function locationFilter(query: string, status: LocationStatus): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    status === "active" ? isNull(location.deletedAt) : undefined,
    status === "deleted" ? isNotNull(location.deletedAt) : undefined,
    query ? ilike(location.name, pattern) : undefined,
  );
}

export async function listLocations({
  page,
  pageSize,
  query,
  status,
  sort,
}: LocationListParams): Promise<LocationPage> {
  const filter = locationFilter(query, status);
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

  const [{ total }] = await db
    .select({ total: count() })
    .from(location)
    .where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select({
      id: location.id,
      name: location.name,
      timezone: location.timezone,
      deletedAt: location.deletedAt,
    })
    .from(location)
    .where(filter)
    .orderBy(...sortTerms(criteria, LOCATION_SORT_EXPRESSIONS), asc(location.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}
