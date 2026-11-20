import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { positionAccessFor } from "./position-access";

// Position pages and actions: HO and admin site. Other roles get notFound().
export async function requirePositionManager() {
  const access = positionAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
