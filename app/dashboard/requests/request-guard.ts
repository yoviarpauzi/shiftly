import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import type { RequestAccess, RequestActor } from "@/types/requests";
import { requestAccessFor } from "./request-access";

// Request pages and actions: HO and admin site. Other roles get notFound(), like requireShiftManager.
export async function requireRequestUser(): Promise<{
  user: RequestActor;
  access: RequestAccess;
}> {
  const user = await requireUser();
  const access = requestAccessFor(user);

  if (!access) {
    notFound();
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role ?? null,
      locationId: user.locationId,
    },
    access,
  };
}
