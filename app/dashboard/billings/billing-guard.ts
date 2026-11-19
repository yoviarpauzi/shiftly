import "server-only";
import { requireRequestUser } from "@/app/dashboard/requests/request-guard";

// Billing pages and actions use the request roles: superadmin, HO, and admin site. Others get notFound().
export async function requireBillingUser() {
  return requireRequestUser();
}
