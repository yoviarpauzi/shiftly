import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { isAllowedRole } from "@/lib/roles";
import { userScopeIsActive } from "@/lib/scope-status";

// The request headers with the Cookie header taken from the cookies() store. After a server
// action sets a cookie, Next re-renders the page in the same request and updates the store, but
// not headers() (see synchronizeMutableCookies in Next's request-store). Without this, a session
// replaced in the action, as changePassword does, is checked by its old, revoked token. Outside
// that re-render the store holds the request's own cookies, so nothing else changes.
async function sessionHeaders(): Promise<Headers> {
  const result = new Headers(await headers());
  const cookieHeader = (await cookies()).toString();

  if (cookieHeader) {
    result.set("cookie", cookieHeader);
  } else {
    result.delete("cookie");
  }

  return result;
}

// Checks the session against the database. This is the real check. proxy.ts only reads the cookie.
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await sessionHeaders() });

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
