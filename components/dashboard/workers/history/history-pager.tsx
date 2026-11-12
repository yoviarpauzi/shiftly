"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HistoryPagerProps } from "@/types/worker-history";
import { TablePagination } from "@/components/dashboard/pagination";

// The count of days and the pager under the table and under the mobile cards.
export function HistoryPager({ page, pageSize, total, monthTotal }: HistoryPagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function goToPage(next: number, size: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", `${next}`);
    params.set("pageSize", `${size}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 text-sm text-muted-foreground">
        {total === monthTotal ? `${total} days` : `${total} of ${monthTotal} days`}
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        pageCount={pageCount}
        onPageChange={(next) => goToPage(next, pageSize)}
        onPageSizeChange={(size) => goToPage(1, size)}
      />
    </div>
  );
}
