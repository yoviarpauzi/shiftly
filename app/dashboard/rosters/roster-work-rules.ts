import "server-only";
import { and, eq, type SQL } from "drizzle-orm";
import { workRule } from "@/database/schema/work-rule-schema";
import { resolveWorkRules } from "@/app/dashboard/settings/settings-rules";
import { ruleColumns } from "@/app/dashboard/settings/settings";
import type { EngineRules, Reader } from "@/types/rosters";
import { toEngineRules } from "./roster-rules";

async function ruleRow(reader: Reader, where: SQL | undefined) {
  const [row] = await reader.select(ruleColumns).from(workRule).where(where);

  return row ?? null;
}

// The work rules that apply to one location: its own saved rules, then its site's, then the global
// ones, then the built-in defaults, resolved rule by rule. It reads through the given reader, so
// generating a roster sees the same rows inside its transaction.
export async function loadEngineRules(
  reader: Reader,
  target: { locationId: string; siteId: string },
): Promise<EngineRules> {
  const global = await ruleRow(reader, eq(workRule.scope, "global"));
  const site = await ruleRow(
    reader,
    and(eq(workRule.scope, "site"), eq(workRule.siteId, target.siteId)),
  );
  const location = await ruleRow(
    reader,
    and(eq(workRule.scope, "location"), eq(workRule.locationId, target.locationId)),
  );

  return toEngineRules(resolveWorkRules({ global, site, location }));
}
