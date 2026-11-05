import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { WorkersEndingNoticeProps } from "@/types/workers";

export function WorkersEndingNotice({ clearHref }: WorkersEndingNoticeProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-2 text-sm">
      <span>Contract ends within 30 days</span>
      <Link href={clearHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
        Clear
      </Link>
    </div>
  );
}
