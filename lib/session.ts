import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { locationAccessFor } from "@/lib/location-access";
import { isAllowedRole } from "@/lib/roles";
import { userScopeIsActive } from "@/lib/scope-status";
import { userAccessFor } from "@/lib/user-access";

// Checks the session against the database. This is the real check. proxy.ts only reads the cookie.
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || !isAllowedRole(session.user.role)) {
    return null;
  }

  // A deactivated user is refused here too, in case a session row outlives the ban.
  if (session.user.banned) {
    return null;
  }

  // A session issued before its site or location was deleted ends here, not at expiry.
  if (!(await userScopeIsActive(session.user))) {
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

// User management pages and actions: superadmin and HO only, as in the "Roles and permissions" table of
// docs/superpowers/specs/2026-11-01-user-crud-design.md. Other roles get notFound(), like requireLocationManager.
export async function requireUserManager() {
  const access = userAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
