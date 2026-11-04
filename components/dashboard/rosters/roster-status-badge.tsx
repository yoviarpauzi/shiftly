import { CircleCheckIcon, CircleDashedIcon, PencilLineIcon } from "lucide-react";
import type { RosterStatusBadgeProps } from "@/types/rosters";
import { Badge } from "@/components/ui/badge";

// Each status differs in variant and icon, so the badge does not rely on color alone.
export function RosterStatusBadge({ status }: RosterStatusBadgeProps) {
  switch (status) {
    case "draft":
      return (
        <Badge variant="secondary">
          <PencilLineIcon />
          Draft
        </Badge>
      );
    case "confirmed":
      return (
        <Badge variant="outline">
          <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />
          Confirmed
        </Badge>
      );
    case "not-generated":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <CircleDashedIcon />
          Not generated
        </Badge>
      );
  }
}
