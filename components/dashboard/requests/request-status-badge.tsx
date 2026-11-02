import { BanIcon, CircleCheckIcon, CircleXIcon, ClockIcon } from "lucide-react";
import type { RequestStatusBadgeProps } from "@/types/requests";
import { Badge } from "@/components/ui/badge";

// Each status differs in variant and icon, so the badge does not rely on color alone.
export function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="secondary">
          <ClockIcon />
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="outline">
          <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive">
          <CircleXIcon />
          Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <BanIcon />
          Cancelled
        </Badge>
      );
  }
}
