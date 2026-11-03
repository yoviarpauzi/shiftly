import type {
  ResolvedSettingsTarget,
  SettingsAccess,
  SettingsSearchParams,
  SettingsTargetLoaders,
} from "@/types/settings";
import { parseSettingsLocation, parseSettingsScope } from "@/validation/settings";
import { parseWorkerSite } from "@/validation/worker-site";
import {
  pickSettingsLocation,
  pickSettingsScope,
  pickSettingsSite,
  workRulesEmptyFor,
} from "./settings-rules";

// The site and location only ever come from the caller's own choice lists, never straight from
// the URL, so an HO cannot read another site's rules by editing ?site=. workRulesFor does no
// access check of its own, so this is what keeps it inside the caller's scope. Locations are only
// listed at location level, the one level that uses them. The loaders are passed in so the rule
// can be tested without a database.
export async function resolveSettingsTarget(
  access: SettingsAccess,
  params: SettingsSearchParams,
  loaders: SettingsTargetLoaders,
): Promise<ResolvedSettingsTarget> {
  const scope = pickSettingsScope(parseSettingsScope(params.scope));
  const siteChoice = await loaders.siteChoiceFor(access);
  const siteId = pickSettingsSite(
    siteChoice,
    parseWorkerSite(params.site, siteChoice.mode === "pick" ? siteChoice.sites : []),
  );
  const locationChoice =
    siteId && scope === "location" ? await loaders.locationChoiceFor(access, siteId) : null;
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
  const load = empty
    ? null
    : {
        scope,
        siteId: scope === "global" ? null : siteId,
        locationId: scope === "location" ? locationId : null,
      };

  return { scope, siteChoice, siteId, locationChoice, locationId, empty, load };
}
