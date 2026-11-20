import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import type { RequestAccess } from "@/types/requests";
import { rosterAccessFor } from "./roster-access";

// Roster pages and actions: HO and admin site. Other roles get notFound(), like requireRequestUser.
export async function requireRosterUser(): Promise<{
  user: { id: string; name: string };
  access: RequestAccess;
}> {
  const user = await requireUser();
  const access = rosterAccessFor(user);

  if (!access) {
    notFound();
  }

  return { user: { id: user.id, name: user.name }, access };
}
