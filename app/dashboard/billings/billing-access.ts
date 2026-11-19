import type { BillingAccess } from "@/types/billings";
import { canWriteToLocation } from "@/app/dashboard/requests/request-access";

// Billing is managed by whoever can write to the billing's location. Issue and void share this rule,
// so this is the one place to change if void is later restricted.
export function canManageBilling(
  access: BillingAccess,
  target: { locationId: string; siteId: string },
): boolean {
  return canWriteToLocation(access, { id: target.locationId, siteId: target.siteId });
}
