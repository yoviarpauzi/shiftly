import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { locationAccessFor } from "./location-access";

// Location pages and actions: only an HO without a location of its own gets in. Everyone else
// (admin site, an HO that has a location, any other role) gets notFound().
export async function requireLocationManager() {
  const access = locationAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
