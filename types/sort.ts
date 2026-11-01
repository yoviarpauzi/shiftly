export type SortDirection = "asc" | "desc";

// One sort step. The list of steps is ordered: the first one is the main sort.
export type SortCriterion<C extends string = string> = {
  column: C;
  direction: SortDirection;
};

// What a sortable table needs: the current sort, and a handler for a header click.
export type SortControl<C extends string> = {
  sort: SortCriterion<C>[];
  onSort: (column: C, shift: boolean) => void;
};
