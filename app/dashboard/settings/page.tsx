import { PasswordForm } from "@/components/dashboard/settings/password-form";
import { WorkRules } from "@/components/dashboard/settings/work-rules";
import type { SettingsAccess, SettingsSearchParams, WorkRulesView } from "@/types/settings";
import { canEditWorkRule, workRuleAccessTargetFor } from "./settings-access";
import { requireSettingsAccess } from "./settings-guard";
import {
  settingsLocationChoiceFor,
  settingsSiteChoiceFor,
  workRulesFor,
} from "./settings";
import { resolveSettingsTarget } from "./settings-target";

async function workRulesViewFor(
  access: SettingsAccess,
  params: SettingsSearchParams,
): Promise<WorkRulesView> {
  const { scope, siteChoice, siteId, locationChoice, empty, load } = await resolveSettingsTarget(
    access,
    params,
    { siteChoiceFor: settingsSiteChoiceFor, locationChoiceFor: settingsLocationChoiceFor },
  );
  const rules = load ? await workRulesFor(load) : null;

  if (!rules) {
    // Either nothing resolved, or the site or location was deleted since it was listed.
    return {
      scope,
      siteChoice,
      siteId,
      locationChoice,
      rules: null,
      canEdit: false,
      empty: empty ?? (scope === "location" ? "no-location" : "no-site"),
    };
  }

  return {
    scope,
    siteChoice,
    siteId,
    locationChoice,
    rules,
    canEdit: canEditWorkRule(access, workRuleAccessTargetFor(rules)),
    empty: null,
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SettingsSearchParams>;
}) {
  const access = await requireSettingsAccess();
  const params = await searchParams;
  const workRules = access ? await workRulesViewFor(access, params) : null;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account and the rules rosters follow.
        </p>
      </div>
      <PasswordForm />
      {workRules && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Work rules</h2>
            <p className="text-sm text-muted-foreground">
              The rules rosters follow, set at global, site, or location level.
            </p>
          </div>
          <WorkRules {...workRules} />
        </section>
      )}
    </div>
  );
}
