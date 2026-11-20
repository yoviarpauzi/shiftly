import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { userAccessFor } from "./user-access";

// User management pages and actions: HO without a location only, as in the "Access model" of
// docs/superpowers/specs/2026-11-20-single-site-design.md. Other roles get notFound(), like requireLocationManager.
export async function requireUserManager() {
  const access = userAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
