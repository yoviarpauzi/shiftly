import "server-only";
import { and, asc, count, ilike, isNotNull, isNull, type SQL, type SQLWrapper, sql } from "drizzle-orm";
import { position } from "@/database/schema/position-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type {
  PositionListParams,
  PositionPage,
  PositionSortColumn,
  PositionStatus,
} from "@/types/positions";
import type { SortCriterion } from "@/types/sort";

const DEFAULT_SORT: SortCriterion<PositionSortColumn>[] = [{ column: "name", direction: "asc" }];

// Each sortable column maps to a fixed expression. URL input only picks a key from this map.
const POSITION_SORT_EXPRESSIONS: Record<PositionSortColumn, SQLWrapper> = {
  name: position.name,
  status: sql`(${position.deletedAt} is not null)`,
};

// Matches name case-insensitively. An empty query matches every position in the status.
function positionFilter(query: string, status: PositionStatus): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    status === "active" ? isNull(position.deletedAt) : undefined,
    status === "deleted" ? isNotNull(position.deletedAt) : undefined,
    query ? ilike(position.name, pattern) : undefined,
  );
}

export async function listPositions({
  page,
  pageSize,
  query,
  status,
  sort,
}: PositionListParams): Promise<PositionPage> {
  const filter = positionFilter(query, status);
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

  const [{ total }] = await db.select({ total: count() }).from(position).where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select({
      id: position.id,
      name: position.name,
      deletedAt: position.deletedAt,
    })
    .from(position)
    .where(filter)
    .orderBy(...sortTerms(criteria, POSITION_SORT_EXPRESSIONS), asc(position.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}
