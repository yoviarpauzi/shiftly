import {
  ClockIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KpiBadgeProps, KpiBadgeTone, KpiCardsProps } from "@/types/dashboard";

const BADGE_ICONS: Record<KpiBadgeTone, LucideIcon | null> = {
  up: TrendingUpIcon,
  down: TrendingDownIcon,
  danger: TriangleAlertIcon,
  pending: ClockIcon,
  neutral: null,
};

function KpiBadge({ badge }: KpiBadgeProps) {
  const Icon = BADGE_ICONS[badge.tone];
  const isDanger = badge.tone === "danger";

  return (
    <Badge
      variant={isDanger ? "destructive" : "outline"}
      className={cn(isDanger && "border-destructive/30")}
    >
      {Icon ? <Icon /> : null}
      {badge.label}
    </Badge>
  );
}

export function KpiCards({ cards }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => {
        const [first, ...rest] = card.lines;

        return (
          <Card
            key={card.key}
            className={cn(
              "@container/card shadow-xs",
              card.danger
                ? "bg-destructive/5 ring-destructive/30"
                : "bg-linear-to-t from-primary/5 to-card"
            )}
          >
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle
                className={cn(
                  "text-4xl font-semibold tabular-nums",
                  card.danger && "text-destructive"
                )}
              >
                {card.value}
              </CardTitle>
              {card.badge ? (
                <CardAction>
                  <KpiBadge badge={card.badge} />
                </CardAction>
              ) : null}
            </CardHeader>
            <CardFooter
              className={cn(
                "mt-auto flex-col items-start gap-1 text-sm",
                card.danger && "border-destructive/20 bg-destructive/5"
              )}
            >
              {first ? <div className="font-medium">{first}</div> : null}
              {rest.map((line) => (
                <div key={line} className="text-muted-foreground">
                  {line}
                </div>
              ))}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
