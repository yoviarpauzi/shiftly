import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { locationAccessFor } from "@/lib/location-access";
import { isAllowedRole } from "@/lib/roles";

// Checks the session against the database. This is the real check. proxy.ts only reads the cookie.
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || !isAllowedRole(session.user.role)) {
    return null;
  }

  return session.user;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

// Superadmin-only pages and actions answer with notFound(), matching app/dashboard/sites/page.tsx.
export async function requireSuperadmin() {
  const user = await requireUser();

  if (user.role !== "superadmin") {
    notFound();
  }

  return user;
}

// Location pages and actions: superadmin and HO only. Other roles get notFound(), like requireSuperadmin.
export async function requireLocationManager() {
  const access = locationAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
