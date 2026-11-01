import { asc, desc, type SQL, type SQLWrapper } from "drizzle-orm";
import type { SortCriterion } from "@/types/sort";

// Turns the criteria into ORDER BY terms. Only columns in `expressions` can be sorted, so URL input never reaches SQL.
export function sortTerms<C extends string>(
  criteria: SortCriterion<C>[],
  expressions: Record<C, SQLWrapper>,
): SQL[] {
  return criteria.map(({ column, direction }) =>
    direction === "asc" ? asc(expressions[column]) : desc(expressions[column]),
  );
}

// A plain click makes the column the only sort. Its direction flips on the next click, then the sort clears.
// A shift-click adds the column after the others. Each shift-click on it flips the direction, then removes it.
export function nextSort<C extends string>(
  current: SortCriterion<C>[],
  column: C,
  shift: boolean,
): SortCriterion<C>[] {
  const existing = current.find((criterion) => criterion.column === column);

  if (!shift) {
    const onlyThisColumn = current.length === 1 && existing !== undefined;

    if (onlyThisColumn && existing.direction === "asc") {
      return [{ column, direction: "desc" }];
    }

    if (onlyThisColumn && existing.direction === "desc") {
      return [];
    }

    return [{ column, direction: "asc" }];
  }

  if (!existing) {
    return [...current, { column, direction: "asc" }];
  }

  if (existing.direction === "asc") {
    return current.map((criterion) =>
      criterion.column === column ? { column, direction: "desc" } : criterion,
    );
  }

  return current.filter((criterion) => criterion.column !== column);
}
