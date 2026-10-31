import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isSuperadminOnlyPath, proxy } from "./proxy";

describe("proxy", () => {
  it("redirects a dashboard request without a session cookie to /sign-in", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/dashboard"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in",
    );
  });

  it("lets a dashboard request with a session cookie through", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/dashboard", {
        headers: { cookie: "better-auth.session_token=some-token" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
  });
});

describe("isSuperadminOnlyPath", () => {
  it.each(["/dashboard/sites", "/dashboard/sites/new"])(
    "marks %s as superadmin only",
    (pathname) => {
      expect(isSuperadminOnlyPath(pathname)).toBe(true);
    },
  );

  it.each(["/dashboard", "/dashboard/users", "/dashboard/sitesmap"])(
    "leaves %s open to any allowed role",
    (pathname) => {
      expect(isSuperadminOnlyPath(pathname)).toBe(false);
    },
  );
});
