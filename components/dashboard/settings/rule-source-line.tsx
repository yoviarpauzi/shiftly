"use client";

import { ruleSourceText } from "@/app/dashboard/settings/settings-rules";
import { Button } from "@/components/ui/button";
import type { RuleSourceLineProps } from "@/types/settings";

// Where the card's value comes from. "Use inherited" clears the value at this level, so it is
// only offered where the level sets its own value and the user may change it.
export function RuleSourceLine({
  ruleKey,
  scope,
  rules,
  canEdit,
  pending,
  onUseInherited,
}: RuleSourceLineProps) {
  const own = rules.own[ruleKey];

  return (
    <div className="flex min-h-6 items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {ruleSourceText({
          scope,
          source: rules.resolved.sources[ruleKey],
          own,
          siteName: rules.siteName,
        })}
      </p>
      {own && canEdit && scope !== "global" && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-primary hover:text-primary"
          disabled={pending}
          onClick={onUseInherited}
        >
          Use inherited
        </Button>
      )}
    </div>
  );
}
