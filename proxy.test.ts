import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

describe("proxy", () => {
  it("redirects a dashboard request without a session cookie to /sign-in", () => {
    const response = proxy(new NextRequest("http://localhost:3000/dashboard"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in",
    );
  });

  it("lets a dashboard request with a session cookie through", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/dashboard", {
        headers: { cookie: "better-auth.session_token=some-token" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
  });
});
