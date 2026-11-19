import { BanIcon, CircleCheckIcon, PencilLineIcon } from "lucide-react";
import type { BillingStatusBadgeProps } from "@/types/billings";
import { Badge } from "@/components/ui/badge";

// Each status differs in variant and icon, so the badge does not rely on color alone.
export function BillingStatusBadge({ status }: BillingStatusBadgeProps) {
  switch (status) {
    case "draft":
      return (
        <Badge variant="secondary">
          <PencilLineIcon />
          Draft
        </Badge>
      );
    case "issued":
      return (
        <Badge variant="outline">
          <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />
          Issued
        </Badge>
      );
    case "void":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <BanIcon />
          Void
        </Badge>
      );
  }
}
