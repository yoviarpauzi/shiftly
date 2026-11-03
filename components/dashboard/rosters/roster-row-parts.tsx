import Link from "next/link";
import type { RosterRow } from "@/types/rosters";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Red when the roster has conflicts, and a dash when there is no roster to count them in.
export function ConflictCount({ count }: { count: number | null }) {
  if (count === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className={cn("tabular-nums", count > 0 && "font-medium text-destructive")}>{count}</span>
  );
}

// Generate for a request with no roster, View for one that has it.
export function RosterRowAction({ row }: { row: RosterRow }) {
  if (row.rosterId === null) {
    return (
      <Link
        href={`/dashboard/rosters/generate?request=${row.requestId}`}
        className={buttonVariants({ size: "sm" })}
        aria-label={`Generate roster for ${row.poNumber}`}
      >
        Generate
      </Link>
    );
  }

  return (
    <Link
      href={`/dashboard/rosters/${row.rosterId}`}
      className={buttonVariants({ variant: "outline", size: "sm" })}
      aria-label={`View roster for ${row.poNumber}`}
    >
      View
    </Link>
  );
}
