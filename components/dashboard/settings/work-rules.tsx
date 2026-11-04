"use client";

import { Building2Icon, MapPinIcon } from "lucide-react";
import { readOnlyNoteFor, workRuleCardKey } from "@/app/dashboard/settings/settings-rules";
import { AnnualOffCard } from "@/components/dashboard/settings/annual-off-card";
import { BreakCard } from "@/components/dashboard/settings/break-card";
import { MaxWorkingDaysCard } from "@/components/dashboard/settings/max-working-days-card";
import { QualificationCard } from "@/components/dashboard/settings/qualification-card";
import { ShiftChangeCard } from "@/components/dashboard/settings/shift-change-card";
import { WorkDaysCard } from "@/components/dashboard/settings/work-days-card";
import { WorkRulesScopeFields } from "@/components/dashboard/settings/work-rules-scope-fields";
import type {
  WorkRuleKey,
  WorkRulesEmptyStateProps,
  WorkRulesProps,
  WorkRulesScope,
} from "@/types/settings";

const EMPTY_COPY = {
  "no-site": {
    Icon: Building2Icon,
    title: "No active site to configure",
    description: "Create a site first, then come back to set its work rules.",
  },
  "no-location": {
    Icon: MapPinIcon,
    title: "No active location to configure",
    description:
      "Create a location in this site first, then set its work rules. Global and Site rules are still available.",
  },
} as const;

function WorkRulesEmptyState({ empty }: WorkRulesEmptyStateProps) {
  const { Icon, title, description } = EMPTY_COPY[empty];

  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
      <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon aria-hidden className="size-5 text-muted-foreground" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function WorkRules({
  scope,
  siteChoice,
  siteId,
  locationChoice,
  rules,
  canEdit,
  empty,
}: WorkRulesProps) {
  const scopeProps: WorkRulesScope = { scope, siteChoice, locationChoice, siteId };

  // No location still lets the user switch to Global or Site. No site leaves nothing to switch to.
  if (empty === "no-location") {
    return (
      <section className="flex flex-col gap-5 rounded-lg border bg-card p-4 sm:p-6">
        <WorkRulesScopeFields {...scopeProps} locationId={null} noLocation />
        <WorkRulesEmptyState empty="no-location" />
      </section>
    );
  }

  if (empty === "no-site" || !rules) {
    return (
      <section className="rounded-lg border bg-card p-4 sm:p-6">
        <WorkRulesEmptyState empty="no-site" />
      </section>
    );
  }

  // workRuleCardKey keeps the six keys apart and resets a card when its level or own value changes.
  const keyFor = (card: WorkRuleKey) => workRuleCardKey(card, rules);
  const cardProps = { rules, scope: scopeProps, canEdit };

  return (
    <div className="flex flex-col gap-4">
      <WorkDaysCard
        key={keyFor("workDaysPerWeek")}
        {...cardProps}
        readOnlyNote={canEdit ? null : readOnlyNoteFor(rules.scope)}
      />
      <MaxWorkingDaysCard
        key={keyFor("maxWorkingDaysPerMonth")}
        {...cardProps}
        readOnlyNote={null}
      />
      <BreakCard key={keyFor("breakDays")} {...cardProps} readOnlyNote={null} />
      <AnnualOffCard key={keyFor("annualOffDays")} {...cardProps} readOnlyNote={null} />
      <ShiftChangeCard key={keyFor("shiftExceptionDays")} {...cardProps} readOnlyNote={null} />
      <QualificationCard
        key={keyFor("requirePositionMatch")}
        {...cardProps}
        readOnlyNote={null}
      />
    </div>
  );
}
