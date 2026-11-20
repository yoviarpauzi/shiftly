import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { locationAccessFor } from "./location-access";

// Location pages and actions: HO only. Other roles get notFound(), like requireHo.
export async function requireLocationManager() {
  const access = locationAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
