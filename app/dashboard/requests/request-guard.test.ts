import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ user: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ requireUser: async () => fake.user }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { requireRequestUser } = await import("./request-guard");

const LOCATION_A = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  fake.user = null;
});

describe("requireRequestUser", () => {
  it("gives HO every location", async () => {
    fake.user = { id: "ho-1", name: "HO", role: "ho", locationId: null };

    const { user, access } = await requireRequestUser();

    expect(access).toEqual({ locationId: null });
    expect(user).toEqual({ id: "ho-1", name: "HO", role: "ho", locationId: null });
  });

  it("limits admin site to its location", async () => {
    fake.user = { id: "a-1", name: "Admin", role: "admin_site", locationId: LOCATION_A };

    const { access } = await requireRequestUser();

    expect(access).toEqual({ locationId: LOCATION_A });
  });

  it.each([
    ["admin site without a location", { role: "admin_site", locationId: null }],
    ["HO with a location", { role: "ho", locationId: LOCATION_A }],
    ["another role", { role: "worker", locationId: null }],
  ])("answers not found for %s", async (_label, fields) => {
    fake.user = { id: "u-1", name: "U", ...fields };

    await expect(requireRequestUser()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
