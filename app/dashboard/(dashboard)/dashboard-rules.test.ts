import { describe, expect, it } from "vitest";

import type { AttendanceCounts, AttentionCounts, DashboardKpis, SeriesPoint } from "@/types/dashboard";

import {
  attendanceRate,
  attentionItems,
  dashboardSubtitle,
  axisTicks,
  formatDayLabel,
  formatLongDay,
  formatMonthDay,
  formatShortDay,
  formatWeekdayDay,
  kpiCards,
  lastDays,
  rateDelta,
  sliceSeries,
  tickDates,
  weekChartCopy,
  weekDays,
} from "./dashboard-rules";

function counts(overrides: Partial<AttendanceCounts> = {}): AttendanceCounts {
  return { scheduled: 0, present: 0, absent: 0, sick: 0, leave: 0, ...overrides };
}

function kpis(overrides: Partial<DashboardKpis> = {}): DashboardKpis {
  return {
    workersToday: 214,
    workersYesterday: 208,
    today: counts({ scheduled: 52, present: 49, absent: 2, sick: 1, leave: 0 }),
    yesterday: counts({ scheduled: 50, present: 48, absent: 1, sick: 1, leave: 0 }),
    openConflicts: 5,
    conflictedRosters: 2,
    pendingRequests: 3,
    oldestPendingDate: "2026-11-06",
    requestsThisWeek: 4,
    requestsThisWeekPending: 1,
    ...overrides,
  };
}

function attention(overrides: Partial<AttentionCounts> = {}): AttentionCounts {
  return {
    pendingRequests: 0,
    draftRosters: 0,
    conflicts: 0,
    conflictedRosters: 0,
    unmarkedLocationIds: [],
    unmarkedWorkers: 0,
    contractsEnding: 0,
    ...overrides,
  };
}

function card(role: Parameters<typeof kpiCards>[0], key: string, overrides: Partial<DashboardKpis> = {}) {
  const found = kpiCards(role, kpis(overrides)).find((item) => item.key === key);

  if (!found) {
    throw new Error(`no ${key} card`);
  }

  return found;
}

describe("attendanceRate", () => {
  it("is present out of marked, with one decimal", () => {
    expect(
      attendanceRate({ scheduled: 214, present: 202, absent: 7, sick: 3, leave: 2 }),
    ).toBe(94.4);
  });

  it("is 100 when everyone marked is present", () => {
    expect(attendanceRate(counts({ scheduled: 5, present: 5 }))).toBe(100);
  });

  it("is null with no shifts", () => {
    expect(attendanceRate(counts())).toBeNull();
  });

  it("is null when shifts exist and nothing is marked", () => {
    expect(attendanceRate(counts({ scheduled: 18 }))).toBeNull();
  });
});

describe("rateDelta", () => {
  it("subtracts the displayed rates without float noise", () => {
    expect(rateDelta(94.2, 96)).toBe(-1.8);
  });

  it("is positive when the rate went up", () => {
    expect(rateDelta(96, 94.2)).toBe(1.8);
  });

  it("is null when either side is null", () => {
    expect(rateDelta(null, 96)).toBeNull();
    expect(rateDelta(94.2, null)).toBeNull();
  });
});

describe("kpiCards order", () => {
  it("shows approvals for superadmin and HO", () => {
    for (const role of ["superadmin", "ho"] as const) {
      expect(kpiCards(role, kpis()).map((item) => item.key)).toEqual([
        "workers",
        "attendance",
        "conflicts",
        "approvals",
      ]);
    }
  });

  it("shows requests for admin site", () => {
    expect(kpiCards("admin_site", kpis()).map((item) => item.key)).toEqual([
      "workers",
      "attendance",
      "requests",
      "conflicts",
    ]);
  });
});

describe("workers card", () => {
  it("shows more than yesterday", () => {
    const workers = card("superadmin", "workers");

    expect(workers.label).toBe("Workers today");
    expect(workers.value).toBe("214");
    expect(workers.badge).toEqual({ label: "+6", tone: "up" });
    expect(workers.lines).toEqual(["6 more than yesterday", "Scheduled in confirmed rosters"]);
    expect(workers.danger).toBe(false);
  });

  it("words the second line for the confirmed roster of one location for admin site", () => {
    const workers = card("admin_site", "workers", { workersToday: 18, workersYesterday: 17 });

    expect(workers.lines).toEqual(["1 more than yesterday", "Scheduled in the confirmed roster"]);
  });

  it("keeps the plural second line for HO", () => {
    expect(card("ho", "workers").lines[1]).toBe("Scheduled in confirmed rosters");
  });

  it("shows the same as yesterday", () => {
    const workers = card("superadmin", "workers", { workersYesterday: 214 });

    expect(workers.badge).toEqual({ label: "0", tone: "neutral" });
    expect(workers.lines).toEqual(["Same as yesterday", "Scheduled in confirmed rosters"]);
  });

  it("shows fewer than yesterday", () => {
    const workers = card("superadmin", "workers", { workersToday: 210, workersYesterday: 214 });

    expect(workers.badge).toEqual({ label: "-4", tone: "down" });
    expect(workers.lines).toEqual(["4 fewer than yesterday", "Scheduled in confirmed rosters"]);
  });
});

describe("attendance card", () => {
  it("shows the rate against yesterday", () => {
    const attendance = card("superadmin", "attendance");

    expect(attendance.label).toBe("Attendance today");
    expect(attendance.value).toBe("94.2%");
    expect(attendance.badge).toEqual({ label: "-1.8%", tone: "down" });
    expect(attendance.lines).toEqual(["Down from 96.0% yesterday", "Present out of marked"]);
  });

  it("says up when the rate rose", () => {
    const attendance = card("superadmin", "attendance", {
      today: counts({ scheduled: 50, present: 48, absent: 1, sick: 1 }),
      yesterday: counts({ scheduled: 52, present: 49, absent: 2, sick: 1 }),
    });

    expect(attendance.value).toBe("96.0%");
    expect(attendance.badge).toEqual({ label: "+1.8%", tone: "up" });
    expect(attendance.lines[0]).toBe("Up from 94.2% yesterday");
  });

  it("says same when the rates are equal", () => {
    const attendance = card("superadmin", "attendance", {
      yesterday: counts({ scheduled: 52, present: 49, absent: 2, sick: 1 }),
    });

    expect(attendance.badge).toEqual({ label: "0.0%", tone: "neutral" });
    expect(attendance.lines[0]).toBe("Same as yesterday");
  });

  it("says nothing was marked yesterday, with no badge", () => {
    const attendance = card("superadmin", "attendance", {
      yesterday: counts({ scheduled: 50 }),
    });

    expect(attendance.value).toBe("94.2%");
    expect(attendance.badge).toBeNull();
    expect(attendance.lines[0]).toBe("Nothing marked yesterday");
  });

  it("adds a line for workers not marked yet", () => {
    const attendance = card("superadmin", "attendance", {
      today: counts({ scheduled: 60, present: 49, absent: 2, sick: 1, leave: 0 }),
    });

    expect(attendance.lines).toEqual([
      "Down from 96.0% yesterday",
      "Present out of marked",
      "8 not marked yet",
    ]);
  });

  it("shows Not marked when nothing is marked but shifts exist", () => {
    const attendance = card("admin_site", "attendance", {
      today: counts({ scheduled: 18 }),
    });

    expect(attendance.value).toBe("Not marked");
    expect(attendance.badge).toEqual({ label: "Pending", tone: "pending" });
    expect(attendance.lines).toEqual(["18 workers are waiting", "Mark attendance to fill this in"]);
  });

  it("uses the singular for one waiting worker", () => {
    const attendance = card("admin_site", "attendance", {
      today: counts({ scheduled: 1 }),
    });

    expect(attendance.lines[0]).toBe("1 worker is waiting");
  });

  it("shows No shifts when nothing is scheduled", () => {
    const attendance = card("superadmin", "attendance", { today: counts() });

    expect(attendance.value).toBe("No shifts");
    expect(attendance.badge).toBeNull();
  });
});

describe("conflicts card", () => {
  it("is red with the roster count", () => {
    const conflicts = card("superadmin", "conflicts");

    expect(conflicts.label).toBe("Open conflicts");
    expect(conflicts.value).toBe("5");
    expect(conflicts.badge).toEqual({ label: "2 rosters", tone: "danger" });
    expect(conflicts.danger).toBe(true);
    expect(conflicts.lines).toEqual([
      "Shifts the rules could not fill",
      "In draft rosters, each with a reason",
    ]);
  });

  it("uses the singular for one roster", () => {
    const conflicts = card("superadmin", "conflicts", { conflictedRosters: 1 });

    expect(conflicts.badge).toEqual({ label: "1 roster", tone: "danger" });
    expect(conflicts.lines[1]).toBe("In 1 draft roster, with a reason");
  });

  it("is calm at zero for a superadmin and an HO", () => {
    for (const role of ["superadmin", "ho"] as const) {
      const conflicts = card(role, "conflicts", { openConflicts: 0, conflictedRosters: 0 });

      expect(conflicts.value).toBe("0");
      expect(conflicts.badge).toEqual({ label: "None", tone: "neutral" });
      expect(conflicts.danger).toBe(false);
      expect(conflicts.lines).toEqual([
        "No unfilled shifts",
        "Every draft roster is fully covered",
      ]);
    }
  });

  it("is calm at zero for an admin site", () => {
    const conflicts = card("admin_site", "conflicts", { openConflicts: 0, conflictedRosters: 0 });

    expect(conflicts.badge).toEqual({ label: "None", tone: "neutral" });
    expect(conflicts.danger).toBe(false);
    expect(conflicts.lines).toEqual([
      "No unfilled shifts",
      "The roster for this week is covered",
    ]);
  });
});

describe("approvals card", () => {
  it("names the oldest request for a superadmin", () => {
    const approvals = card("superadmin", "approvals");

    expect(approvals.label).toBe("Pending approvals");
    expect(approvals.value).toBe("3");
    expect(approvals.badge).toEqual({ label: "Weekly", tone: "pending" });
    expect(approvals.lines).toEqual([
      "Waiting for HO or a superadmin",
      "Oldest request is from Fri 6 Nov",
    ]);
  });

  it("speaks to the HO in the second person", () => {
    const approvals = card("ho", "approvals");

    expect(approvals.lines).toEqual([
      "Waiting for you or a superadmin",
      "Oldest request is from Fri 6 Nov",
    ]);
  });

  it("says Requested on for a single request", () => {
    const approvals = card("ho", "approvals", { pendingRequests: 1 });

    expect(approvals.lines[1]).toBe("Requested on Fri 6 Nov");
  });

  it("is empty at zero", () => {
    for (const role of ["superadmin", "ho"] as const) {
      const approvals = card(role, "approvals", {
        pendingRequests: 0,
        oldestPendingDate: null,
      });

      expect(approvals.value).toBe("0");
      expect(approvals.badge?.label).toBe("Weekly");
      expect(approvals.danger).toBe(false);
      expect(approvals.lines).toEqual([
        "No request is waiting",
        "Every weekly request is decided",
      ]);
    }
  });
});

describe("requests card", () => {
  it("counts the week with the pending ones in the badge", () => {
    const requests = card("admin_site", "requests");

    expect(requests.label).toBe("Requests this week");
    expect(requests.value).toBe("4");
    expect(requests.badge).toEqual({ label: "1 pending", tone: "pending" });
    expect(requests.lines).toEqual([
      "1 is waiting for HO approval",
      "Only HO or superadmin can approve",
    ]);
  });

  it("counts several waiting requests", () => {
    const requests = card("admin_site", "requests", { requestsThisWeekPending: 2 });

    expect(requests.lines[0]).toBe("2 are waiting for HO approval");
  });

  it("says None pending at zero", () => {
    const requests = card("admin_site", "requests", { requestsThisWeekPending: 0 });

    expect(requests.badge).toEqual({ label: "None pending", tone: "neutral" });
    expect(requests.lines).toEqual([
      "None waiting for HO approval",
      "Only HO or superadmin can approve",
    ]);
  });
});

describe("attentionItems", () => {
  it("is empty when every count is 0", () => {
    expect(attentionItems("superadmin", attention(), "2026-11-09")).toEqual([]);
  });

  it("shows only the items above 0, in a fixed order", () => {
    const items = attentionItems(
      "superadmin",
      attention({
        contractsEnding: 6,
        conflicts: 5,
        conflictedRosters: 2,
        draftRosters: 2,
        pendingRequests: 3,
        unmarkedLocationIds: ["a", "b", "c", "d"],
      }),
      "2026-11-09",
    );

    expect(items.map((item) => item.key)).toEqual([
      "requests",
      "drafts",
      "conflicts",
      "attendance",
      "contracts",
    ]);
    expect(items.map((item) => item.title)).toEqual([
      "3 requests are waiting for approval",
      "2 rosters are still drafts",
      "5 conflicts in draft rosters",
      "Attendance is not marked in 4 locations today",
      "6 worker contracts end within 30 days",
    ]);
    expect(items.map((item) => item.detail)).toEqual([
      "Weekly requests stay pending until HO or a superadmin approves them.",
      "Confirm a roster so attendance can be marked against it.",
      "Shifts the rules could not fill, each with its reason.",
      "Mon, 9 Nov 2026. Confirmed rosters are waiting to be marked.",
      "Renew or replace these workers before their end date.",
    ]);
    expect(items.map((item) => item.button)).toEqual([
      "Review",
      "Open rosters",
      "View conflicts",
      "Mark attendance",
      "View workers",
    ]);
    expect(items.map((item) => item.href)).toEqual([
      "/dashboard/requests?status=pending",
      "/dashboard/rosters?status=draft",
      "/dashboard/rosters?status=draft",
      "/dashboard/attendance",
      "/dashboard/workers?ending=1",
    ]);
  });

  it("omits an item whose count is 0", () => {
    const items = attentionItems("ho", attention({ draftRosters: 1 }), "2026-11-09");

    expect(items.map((item) => item.key)).toEqual(["drafts"]);
  });

  it("uses the singular forms for one", () => {
    const items = attentionItems(
      "superadmin",
      attention({
        pendingRequests: 1,
        draftRosters: 1,
        conflicts: 1,
        conflictedRosters: 1,
        unmarkedLocationIds: ["loc-1"],
        unmarkedWorkers: 18,
        contractsEnding: 1,
      }),
      "2026-11-09",
    );

    expect(items.map((item) => item.title)).toEqual([
      "1 request is waiting for approval",
      "1 roster is still a draft",
      "1 conflict in the draft roster",
      "Attendance is not marked today",
      "1 worker contract ends within 30 days",
    ]);
    expect(items.map((item) => item.detail)).toEqual([
      "Weekly requests stay pending until HO or a superadmin approves them.",
      "Confirm it so attendance can be marked against it.",
      "Shifts the rules could not fill, each with its reason.",
      "Mon, 9 Nov 2026. 18 workers in the confirmed roster are waiting to be marked.",
      "Renew or replace these workers before their end date.",
    ]);
  });

  it("matches the HO frame item by item", () => {
    const items = attentionItems(
      "ho",
      attention({
        pendingRequests: 1,
        draftRosters: 1,
        conflicts: 2,
        conflictedRosters: 1,
        unmarkedLocationIds: ["a", "b"],
        unmarkedWorkers: 30,
        contractsEnding: 3,
      }),
      "2026-11-09",
    );

    expect(items.map((item) => [item.title, item.detail, item.button])).toEqual([
      [
        "1 request is waiting for approval",
        "Weekly requests stay pending until you or a superadmin approve them.",
        "Review",
      ],
      [
        "1 roster is still a draft",
        "Confirm it so attendance can be marked against it.",
        "Open rosters",
      ],
      [
        "2 conflicts in the draft roster",
        "Shifts the rules could not fill, each with its reason.",
        "View conflicts",
      ],
      [
        "Attendance is not marked in 2 locations today",
        "Mon, 9 Nov 2026. Confirmed rosters are waiting to be marked.",
        "Mark attendance",
      ],
      [
        "3 worker contracts end within 30 days",
        "Renew or replace these workers before their end date.",
        "View workers",
      ],
    ]);
  });

  it("matches the admin site frame item by item, attendance first", () => {
    const items = attentionItems(
      "admin_site",
      attention({
        pendingRequests: 1,
        unmarkedLocationIds: ["loc-1"],
        unmarkedWorkers: 18,
        contractsEnding: 2,
      }),
      "2026-11-09",
    );

    expect(items.map((item) => item.key)).toEqual(["attendance", "requests", "contracts"]);
    expect(items.map((item) => [item.title, item.detail, item.button])).toEqual([
      [
        "Attendance is not marked today",
        "Mon, 9 Nov 2026. 18 workers in the confirmed roster are waiting to be marked.",
        "Mark attendance",
      ],
      [
        "1 request is waiting for HO approval",
        "You can follow its status here. Only HO or a superadmin can approve it.",
        "View request",
      ],
      [
        "2 worker contracts end within 30 days",
        "Renew or replace these workers before their end date.",
        "View workers",
      ],
    ]);
  });

  it("keeps requests before attendance for a superadmin with the same counts", () => {
    const items = attentionItems(
      "superadmin",
      attention({
        pendingRequests: 1,
        unmarkedLocationIds: ["loc-1"],
        unmarkedWorkers: 18,
        contractsEnding: 2,
      }),
      "2026-11-09",
    );

    expect(items.map((item) => item.key)).toEqual(["requests", "attendance", "contracts"]);
  });

  it("orders every admin site item attendance, requests, drafts, conflicts, contracts", () => {
    const items = attentionItems(
      "admin_site",
      attention({
        pendingRequests: 1,
        draftRosters: 1,
        conflicts: 1,
        conflictedRosters: 1,
        unmarkedLocationIds: ["loc-1"],
        contractsEnding: 1,
      }),
      "2026-11-09",
    );

    expect(items.map((item) => item.key)).toEqual([
      "attendance",
      "requests",
      "drafts",
      "conflicts",
      "contracts",
    ]);
  });

  it("words the draft detail for several rosters", () => {
    const [item] = attentionItems("superadmin", attention({ draftRosters: 2 }), "2026-11-09");

    expect(item.detail).toBe("Confirm a roster so attendance can be marked against it.");
  });

  it("falls back to the generic attendance detail for one location with no worker count", () => {
    const [item] = attentionItems(
      "superadmin",
      attention({ unmarkedLocationIds: ["loc-1"], unmarkedWorkers: 0 }),
      "2026-11-09",
    );

    expect(item.title).toBe("Attendance is not marked today");
    expect(item.detail).toBe("Mon, 9 Nov 2026. Confirmed rosters are waiting to be marked.");
    expect(item.href).toBe("/dashboard/attendance?location=loc-1");
  });

  it("uses the singular worker wording for one unmarked worker", () => {
    const [item] = attentionItems(
      "admin_site",
      attention({ unmarkedLocationIds: ["loc-1"], unmarkedWorkers: 1 }),
      "2026-11-09",
    );

    expect(item.detail).toBe(
      "Mon, 9 Nov 2026. 1 worker in the confirmed roster is waiting to be marked.",
    );
  });

  it("says the draft roster when many conflicts sit in one roster", () => {
    const items = attentionItems(
      "superadmin",
      attention({ conflicts: 2, conflictedRosters: 1 }),
      "2026-11-09",
    );

    expect(items[0].title).toBe("2 conflicts in the draft roster");
  });

  it("links to one location when exactly one is unmarked", () => {
    const [item] = attentionItems(
      "admin_site",
      attention({ unmarkedLocationIds: ["loc-1"], unmarkedWorkers: 18 }),
      "2026-11-09",
    );

    expect(item.href).toBe("/dashboard/attendance?location=loc-1");
    expect(item.detail).toBe(
      "Mon, 9 Nov 2026. 18 workers in the confirmed roster are waiting to be marked.",
    );
  });

  it("does not pick a location when several are unmarked", () => {
    const [item] = attentionItems(
      "superadmin",
      attention({ unmarkedLocationIds: ["a", "b"], unmarkedWorkers: 30 }),
      "2026-11-09",
    );

    expect(item.href).toBe("/dashboard/attendance");
    expect(item.detail).toBe("Mon, 9 Nov 2026. Confirmed rosters are waiting to be marked.");
  });

  it("words the admin site approvals item for several requests", () => {
    const [item] = attentionItems("admin_site", attention({ pendingRequests: 3 }), "2026-11-09");

    expect(item.title).toBe("3 requests are waiting for HO approval");
    expect(item.button).toBe("View request");
    expect(item.detail).toBe(
      "You can follow their status here. Only HO or a superadmin can approve them.",
    );
  });

  it("words the admin site approvals item for a user who cannot approve", () => {
    const [item] = attentionItems("admin_site", attention({ pendingRequests: 1 }), "2026-11-09");

    expect(item.title).toBe("1 request is waiting for HO approval");
    expect(item.button).toBe("View request");
    expect(item.detail).toBe(
      "You can follow its status here. Only HO or a superadmin can approve it.",
    );
    expect(item.href).toBe("/dashboard/requests?status=pending");
  });
});

describe("weekDays", () => {
  it("starts on a Monday and runs seven days", () => {
    expect(weekDays("2026-11-09")).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
  });

  it("keeps a Sunday in the week that started six days before", () => {
    expect(weekDays("2026-11-15")).toEqual(weekDays("2026-11-09"));
  });

  it("goes back to the Monday from midweek", () => {
    expect(weekDays("2026-11-12")[0]).toBe("2026-11-09");
  });

  it("crosses a month boundary", () => {
    expect(weekDays("2026-11-03")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    expect(weekDays("2026-10-30").at(-1)).toBe("2026-11-01");
  });

  it("crosses a year boundary", () => {
    expect(weekDays("2026-12-30")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("lastDays", () => {
  it("lists the dates oldest first, ending today", () => {
    expect(lastDays("2026-11-09", 3)).toEqual(["2026-11-07", "2026-11-08", "2026-11-09"]);
  });

  it("returns thirty dates", () => {
    const days = lastDays("2026-11-09", 30);

    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-10-11");
    expect(days.at(-1)).toBe("2026-11-09");
  });
});

describe("sliceSeries", () => {
  const series: SeriesPoint[] = lastDays("2026-11-09", 30).map((date, index) => ({
    date,
    present: index,
    notPresent: 0,
  }));

  it("keeps the last 30, 14, and 7 days", () => {
    expect(sliceSeries(series, "30d")).toHaveLength(30);
    expect(sliceSeries(series, "14d")).toHaveLength(14);
    expect(sliceSeries(series, "7d")).toHaveLength(7);
  });

  it("keeps the newest points, oldest first", () => {
    const week = sliceSeries(series, "7d");

    expect(week[0].date).toBe("2026-11-03");
    expect(week.at(-1)?.date).toBe("2026-11-09");
  });
});

describe("dashboardSubtitle", () => {
  it("covers all sites for a superadmin", () => {
    expect(dashboardSubtitle("superadmin", { siteName: null, locationName: null })).toBe(
      "Everything that needs attention across all sites.",
    );
  });

  it("names the site for an HO", () => {
    expect(
      dashboardSubtitle("ho", { siteName: "Indofood Cikarang", locationName: null }),
    ).toBe("Everything that needs attention at Indofood Cikarang.");
  });

  it("names the site and location for an admin site", () => {
    expect(
      dashboardSubtitle("admin_site", { siteName: "Nestle Kejayan", locationName: "Gudang Utara" }),
    ).toBe("What needs attention at Nestle Kejayan / Gudang Utara.");
  });

  it("falls back when a name is missing", () => {
    expect(dashboardSubtitle("ho", { siteName: null, locationName: null })).toBe(
      "Everything that needs attention at your site.",
    );
    expect(dashboardSubtitle("admin_site", { siteName: null, locationName: null })).toBe(
      "What needs attention at your location.",
    );
    expect(
      dashboardSubtitle("admin_site", { siteName: null, locationName: "Gudang Utara" }),
    ).toBe("What needs attention at Gudang Utara.");
  });
});

describe("day labels", () => {
  it("formats the card day label", () => {
    expect(formatDayLabel("2026-11-05")).toBe("Thu, 5 Nov");
  });

  it("formats the long day with the year", () => {
    expect(formatLongDay("2026-11-09")).toBe("Mon, 9 Nov 2026");
  });

  it("formats the short day without a comma", () => {
    expect(formatShortDay("2026-11-06")).toBe("Fri 6 Nov");
  });

  it("formats the weekday and day for a bar label", () => {
    expect(formatWeekdayDay("2026-11-09")).toBe("Mon 9");
    expect(formatWeekdayDay("2026-11-15")).toBe("Sun 15");
  });

  it("names a Sunday and a year boundary correctly", () => {
    expect(formatLongDay("2027-01-03")).toBe("Sun, 3 Jan 2027");
  });
});

describe("axisTicks", () => {
  it("steps by 50 for a series that peaks near 225", () => {
    expect(axisTicks(225, 4)).toEqual([0, 50, 100, 150, 200, 250]);
  });

  it("keeps a scale of the minimum for an empty chart", () => {
    expect(axisTicks(0, 4)).toEqual([0, 1, 2, 3, 4]);
    expect(axisTicks(0, 3)).toEqual([0, 1, 2, 3]);
  });

  it("uses whole numbers for small counts", () => {
    expect(axisTicks(2, 3)).toEqual([0, 1, 2, 3]);
    expect(axisTicks(18, 3)).toEqual([0, 5, 10, 15, 20]);
  });

  it("ends on a tick at or above the largest value", () => {
    for (const max of [1, 5, 6, 12, 99, 101, 202, 1234]) {
      const ticks = axisTicks(max, 3);

      expect(ticks.at(-1)).toBeGreaterThanOrEqual(max);
      expect(ticks.length).toBeLessThanOrEqual(6);
    }
  });
});

describe("formatMonthDay", () => {
  it("formats a date as month and day without a weekday", () => {
    expect(formatMonthDay("2026-11-09")).toBe("Nov 9");
    expect(formatMonthDay("2026-10-12")).toBe("Oct 12");
    expect(formatMonthDay("2027-01-03")).toBe("Jan 3");
  });
});

describe("tickDates", () => {
  const series = lastDays("2026-11-09", 30).map((date) => ({ date, present: 0, notPresent: 0 }));

  it("takes every 4th date of 30 days, ending on the last date", () => {
    expect(tickDates(sliceSeries(series, "30d"), "30d").map(formatMonthDay)).toEqual([
      "Oct 12",
      "Oct 16",
      "Oct 20",
      "Oct 24",
      "Oct 28",
      "Nov 1",
      "Nov 5",
      "Nov 9",
    ]);
  });

  it("takes every 2nd date of 14 days, ending on the last date", () => {
    const ticks = tickDates(sliceSeries(series, "14d"), "14d");

    expect(ticks).toHaveLength(7);
    expect(ticks.at(-1)).toBe("2026-11-09");
    expect(ticks[0]).toBe("2026-10-28");
  });

  it("takes every date of 7 days", () => {
    expect(tickDates(sliceSeries(series, "7d"), "7d")).toEqual(
      sliceSeries(series, "7d").map((point) => point.date),
    );
  });

  it("returns nothing for an empty series", () => {
    expect(tickDates([], "30d")).toEqual([]);
  });
});

describe("weekChartCopy", () => {
  it("frames the gaps chart for a superadmin", () => {
    expect(weekChartCopy("superadmin", kpis({ openConflicts: 5, conflictedRosters: 2 }))).toEqual({
      title: "Gaps in this week's rosters",
      description: "Shifts the rules could not fill, per day",
      caption: "5 conflicts in 2 draft rosters",
      tone: "danger",
    });
  });

  it("uses the same gaps chart for an HO", () => {
    expect(weekChartCopy("ho", kpis({ openConflicts: 2, conflictedRosters: 1 }))).toEqual({
      title: "Gaps in this week's rosters",
      description: "Shifts the rules could not fill, per day",
      caption: "2 conflicts in 1 draft roster",
      tone: "danger",
    });
  });

  it("uses the singular for one conflict", () => {
    expect(weekChartCopy("superadmin", kpis({ openConflicts: 1, conflictedRosters: 1 })).caption).toBe(
      "1 conflict in 1 draft roster",
    );
  });

  it("says nothing is unfilled when there are no conflicts", () => {
    expect(weekChartCopy("ho", kpis({ openConflicts: 0, conflictedRosters: 0 })).caption).toBe(
      "No unfilled shifts this week",
    );
  });

  it("shows the scheduled workers for an admin site", () => {
    expect(weekChartCopy("admin_site", kpis({ openConflicts: 0, conflictedRosters: 0 }))).toEqual({
      title: "Workers scheduled this week",
      description: "Workers on a shift, per day",
      caption: "No unfilled shifts this week",
      tone: "primary",
    });
  });

  it("counts the conflicts in the draft roster for an admin site", () => {
    expect(weekChartCopy("admin_site", kpis({ openConflicts: 2, conflictedRosters: 1 })).caption).toBe(
      "2 conflicts in the draft roster",
    );
    expect(weekChartCopy("admin_site", kpis({ openConflicts: 1, conflictedRosters: 1 })).caption).toBe(
      "1 conflict in the draft roster",
    );
  });
});
