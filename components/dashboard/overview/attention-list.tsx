import Link from "next/link";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  AttentionHeaderProps,
  AttentionKey,
  AttentionListProps,
} from "@/types/dashboard";

const ITEM_ICONS: Record<AttentionKey, LucideIcon> = {
  requests: ClipboardListIcon,
  drafts: CalendarDaysIcon,
  conflicts: TriangleAlertIcon,
  attendance: ClipboardCheckIcon,
  contracts: CalendarClockIcon,
};

function AttentionHeader({ count }: AttentionHeaderProps) {
  return (
    <CardHeader className="border-b">
      <div className="flex items-center gap-2">
        <CardTitle>Needs attention</CardTitle>
        <Badge variant={count > 0 ? "destructive" : "secondary"}>{count}</Badge>
      </div>
    </CardHeader>
  );
}

export function AttentionList({ items }: AttentionListProps) {
  if (items.length === 0) {
    return (
      <Card className="h-full">
        <AttentionHeader count={0} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-(--card-spacing) py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-chart-2/15 text-chart-4">
            <ClipboardCheckIcon className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-medium">All caught up</p>
            <p className="max-w-sm text-muted-foreground">
              No request is waiting, every draft roster is confirmed, and
              today&apos;s attendance is marked in every location.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <AttentionHeader count={items.length} />
      <ul className="flex flex-col divide-y">
        {items.map((item) => {
          const Icon = ITEM_ICONS[item.key];
          const isConflict = item.key === "conflicts";

          return (
            <li
              key={item.key}
              className="flex flex-col gap-3 px-(--card-spacing) py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    isConflict
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground">{item.detail}</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="min-h-11 w-full sm:min-h-8 sm:w-auto"
                render={<Link href={item.href} />}
                nativeButton={false}
              >
                {item.button}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
