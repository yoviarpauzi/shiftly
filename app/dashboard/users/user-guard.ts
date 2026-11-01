import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { userAccessFor } from "./user-access";

// User management pages and actions: superadmin and HO only, as in the "Roles and permissions" table of
// docs/superpowers/specs/2026-11-01-user-crud-design.md. Other roles get notFound(), like requireLocationManager.
export async function requireUserManager() {
  const access = userAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
