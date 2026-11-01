import type { RawParam } from "@/types/pagination";
import type { SortCriterion, SortDirection } from "@/types/sort";

const DIRECTIONS: readonly string[] = ["asc", "desc"] satisfies readonly SortDirection[];

// Reads "name:asc,locations:desc". Unknown columns, unknown directions, and repeated columns are dropped.
export function parseSortParam<C extends string>(
  value: RawParam,
  allowed: readonly C[],
): SortCriterion<C>[] {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return [];
  }

  const seen = new Set<string>();
  const criteria: SortCriterion<C>[] = [];

  for (const part of raw.split(",")) {
    const [column, direction] = part.split(":");

    if (!(allowed as readonly string[]).includes(column) || seen.has(column)) {
      continue;
    }

    if (!DIRECTIONS.includes(direction)) {
      continue;
    }

    seen.add(column);
    criteria.push({ column: column as C, direction: direction as SortDirection });
  }

  return criteria;
}

export function serializeSort(criteria: SortCriterion[]): string {
  return criteria.map((criterion) => `${criterion.column}:${criterion.direction}`).join(",");
}
