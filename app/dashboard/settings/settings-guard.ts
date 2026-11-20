import "server-only";
import { requireUser } from "@/lib/session";
import type { SettingsAccess } from "@/types/settings";
import { settingsAccessFor } from "./settings-access";

// Every signed-in user may open Settings to change their password. The work rules need a scope,
// so a user without one gets null (no work-rules section) rather than notFound().
export async function requireSettingsAccess(): Promise<SettingsAccess | null> {
  return settingsAccessFor(await requireUser());
}
