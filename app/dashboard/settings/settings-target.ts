import type {
  ResolvedSettingsTarget,
  SettingsAccess,
  SettingsSearchParams,
  SettingsTargetLoaders,
} from "@/types/settings";
import { parseSettingsLocation, parseSettingsScope } from "@/validation/settings";
import { pickSettingsLocation, pickSettingsScope, workRulesEmptyFor } from "./settings-rules";

// The location only ever comes from the caller's own choice list, never straight from the URL, so
// an admin site cannot read another location's rules by editing ?location=. workRulesFor does no
// access check of its own, so this is what keeps it inside the caller's scope. Locations are only
// listed at location level, the one level that uses them. The loader is passed in so the rule can
// be tested without a database.
export async function resolveSettingsTarget(
  access: SettingsAccess,
  params: SettingsSearchParams,
  loaders: SettingsTargetLoaders,
): Promise<ResolvedSettingsTarget> {
  const scope = pickSettingsScope(parseSettingsScope(params.scope));
  const locationChoice = scope === "location" ? await loaders.locationChoiceFor(access) : null;
  const locationId = locationChoice
    ? pickSettingsLocation(
        locationChoice,
        parseSettingsLocation(
          params.location,
          locationChoice.mode === "pick" ? locationChoice.locations : [],
        ),
      )
    : null;
  const empty = workRulesEmptyFor({ scope, locationId });
  const load = empty ? null : { scope, locationId };

  return { scope, locationChoice, locationId, empty, load };
}
