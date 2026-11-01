import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import type { SortCriterion } from "@/types/sort";
import { Button } from "@/components/ui/button";

// Shows the column's place in the sort. Shift-click adds it after the other sorts.
export function SortHeader<C extends string>({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: C;
  sort: SortCriterion<C>[];
  onSort: (column: C, shift: boolean) => void;
}) {
  const index = sort.findIndex((criterion) => criterion.column === column);
  const active = index === -1 ? undefined : sort[index];

  const Icon = !active
    ? ArrowUpDownIcon
    : active.direction === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2.5 h-7 px-2.5"
      title="Click to sort. Shift-click to add a second sort."
      onClick={(event) => onSort(column, event.shiftKey)}
    >
      {label}
      <Icon aria-hidden className="size-3.5" />
      {sort.length > 1 && active && (
        <span className="text-xs tabular-nums">{index + 1}</span>
      )}
    </Button>
  );
}
