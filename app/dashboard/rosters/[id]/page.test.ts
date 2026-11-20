import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RosterDetail } from "@/types/rosters";

const fake = vi.hoisted(() => ({
  user: null as unknown,
  // The rosters by location, as getRoster would find them under its scope filter.
  rosters: new Map<string, unknown>(),
  getRosterCalls: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ requireUser: async () => fake.user }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/components/dashboard/rosters/roster-detail", () => ({ RosterDetailView: () => null }));
vi.mock("@/components/dashboard/rosters/roster-status-badge", () => ({
  RosterStatusBadge: () => null,
}));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => null }));
vi.mock("../rosters", () => ({
  // Stands in for the scope filter of the real query: a roster is found only when the access
  // allows its location.
  getRoster: async (access: { locationId: string | null }, id: string) => {
    fake.getRosterCalls.push([access, id]);
    const found = fake.rosters.get(id) as { locationId: string } | undefined;

    return found && (access.locationId === null || access.locationId === found.locationId)
      ? found
      : null;
  },
  getGenerateView: async () => null,
}));

const { default: Page } = await import("./page");

const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";
const ROSTER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ROSTER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const rosterAt = (locationId: string): RosterDetail =>
  ({
    id: "x",
    requestId: "r",
    poNumber: "PO-202611-0001",
    type: "weekly",
    startDate: "2026-11-09",
    locationId,
    locationName: "Gudang",
    status: "draft",
    editable: false,
    generatedByName: null,
    generatedAt: "2026-11-03T10:00:00.000Z",
    confirmedByName: null,
    confirmedAt: null,
    version: "v",
  }) as unknown as RosterDetail;

// Page returns a Suspense around the async detail component. Renders that component directly.
async function openRoster(id: string) {
  const suspense = Page({ params: Promise.resolve({ id }) }) as {
    props: { children: { type: (props: unknown) => Promise<unknown>; props: unknown } };
  };
  const { type, props } = suspense.props.children;

  return type(props);
}

beforeEach(() => {
  fake.user = null;
  fake.getRosterCalls = [];
  fake.rosters = new Map([
    [ROSTER_A, rosterAt(LOCATION_A)],
    [ROSTER_B, rosterAt(LOCATION_B)],
  ]);
});

describe("roster detail page", () => {
  it("opens a roster of its own location for admin site", async () => {
    fake.user = { id: "a-1", name: "Admin", role: "admin_site", locationId: LOCATION_A };

    await expect(openRoster(ROSTER_A)).resolves.toBeTruthy();
    expect(fake.getRosterCalls).toEqual([[{ locationId: LOCATION_A }, ROSTER_A]]);
  });

  it("answers not found for a roster of another location to admin site", async () => {
    fake.user = { id: "a-1", name: "Admin", role: "admin_site", locationId: LOCATION_A };

    await expect(openRoster(ROSTER_B)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("opens the rosters of both locations for HO", async () => {
    fake.user = { id: "ho-1", name: "HO", role: "ho", locationId: null };

    await expect(openRoster(ROSTER_A)).resolves.toBeTruthy();
    await expect(openRoster(ROSTER_B)).resolves.toBeTruthy();
    expect(fake.getRosterCalls[0]).toEqual([{ locationId: null }, ROSTER_A]);
  });

  it("answers not found for a malformed id without querying", async () => {
    fake.user = { id: "ho-1", name: "HO", role: "ho", locationId: null };

    await expect(openRoster("nope")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fake.getRosterCalls).toEqual([]);
  });

  it.each([
    ["admin site without a location", { role: "admin_site", locationId: null }],
    ["HO with a location", { role: "ho", locationId: LOCATION_A }],
  ])("answers not found for %s before reading anything", async (_label, fields) => {
    fake.user = { id: "u-1", name: "U", ...fields };

    await expect(openRoster(ROSTER_A)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fake.getRosterCalls).toEqual([]);
  });
});
