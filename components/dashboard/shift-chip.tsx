import { cn } from "@/lib/utils";

// Three tints that repeat for further shifts, so a shift keeps its colour wherever it is shown.
const SHIFT_TINTS = [
  "bg-primary/10 text-primary",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-muted text-muted-foreground",
];

// "S1", "S2", "S3" by the shift's order.
export function ShiftChip({ order, className }: { order: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-10 items-center justify-center rounded-md px-2 text-xs font-medium",
        SHIFT_TINTS[(order - 1 + SHIFT_TINTS.length) % SHIFT_TINTS.length],
        className,
      )}
    >
      S{order}
    </span>
  );
}
