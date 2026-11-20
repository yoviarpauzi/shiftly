import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { locationAccessFor } from "./location-access";

// Location pages and actions: HO only, and stricter than requireHo: an HO that carries a location
// of its own is refused too. Anyone refused gets notFound().
export async function requireLocationManager() {
  const access = locationAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
