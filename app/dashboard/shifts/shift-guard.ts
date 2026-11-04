import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { shiftAccessFor } from "./shift-access";

// Shift pages and actions: superadmin, HO, and admin site. Other roles get notFound(), like requireSuperadmin.
export async function requireShiftManager() {
  const access = shiftAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
