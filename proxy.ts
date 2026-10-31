import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const SUPERADMIN_ONLY_PATHS = ["/dashboard/sites"];

export function isSuperadminOnlyPath(pathname: string) {
  return SUPERADMIN_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// Reads the cookie first. For superadmin-only paths it also reads the role, so the 403 is sent before the page streams.
// The page and lib/session.ts check again.
export async function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (isSuperadminOnlyPath(request.nextUrl.pathname)) {
    // Loaded only here, so other dashboard requests never touch the database.
    const { auth } = await import("./lib/auth");
    const session = await auth.api.getSession({ headers: request.headers });

    if (session?.user.role !== "superadmin") {
      return NextResponse.rewrite(new URL("/access-denied", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
