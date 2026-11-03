import { SettingsTabs } from "@/components/dashboard/settings/settings-tabs";
import type { SettingsAccess, WorkRulesView } from "@/types/settings";
import {
  parseSettingsLocation,
  parseSettingsScope,
  parseSettingsTab,
} from "@/validation/settings";
import { parseWorkerSite } from "@/validation/worker-site";
import { canEditWorkRule, workRuleAccessTargetFor } from "./settings-access";
import { requireSettingsAccess } from "./settings-guard";
import {
  pickSettingsLocation,
  pickSettingsScope,
  pickSettingsSite,
  workRulesEmptyFor,
} from "./settings-rules";
import {
  settingsLocationChoiceFor,
  settingsSiteChoiceFor,
  workRulesFor,
} from "./settings";

// The site and location only ever come from the caller's own choice lists, never straight from
// the URL, so an HO cannot read another site's rules by editing ?site=. Locations are only
// listed at location level, the one level that uses them.
async function workRulesViewFor(
  access: SettingsAccess,
  params: Record<string, string | string[] | undefined>,
): Promise<WorkRulesView> {
  const scope = pickSettingsScope(parseSettingsScope(params.scope));
  const siteChoice = await settingsSiteChoiceFor(access);
  const siteId = pickSettingsSite(
    siteChoice,
    parseWorkerSite(params.site, siteChoice.mode === "pick" ? siteChoice.sites : []),
  );
  const locationChoice =
    siteId && scope === "location" ? await settingsLocationChoiceFor(access, siteId) : null;
  const locationId = locationChoice
    ? pickSettingsLocation(
        locationChoice,
        parseSettingsLocation(
          params.location,
          locationChoice.mode === "pick" ? locationChoice.locations : [],
        ),
      )
    : null;
  const empty = workRulesEmptyFor({ scope, siteId, locationId });
  const rules = empty
    ? null
    : await workRulesFor({
        scope,
        siteId: scope === "global" ? null : siteId,
        locationId: scope === "location" ? locationId : null,
      });

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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
      <SettingsTabs workRules={workRules} tab={parseSettingsTab(params.tab, workRules !== null)} />
    </div>
  );
}
