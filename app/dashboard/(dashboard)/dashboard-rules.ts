import { addDays } from "@/app/dashboard/rosters/roster-rules";
import type {
  AttendanceCounts,
  AttentionCounts,
  AttentionItem,
  AttentionKey,
  DashboardKpis,
  DashboardRole,
  KpiCard,
  SeriesPoint,
  SeriesRange,
  WeekChartCopy,
} from "@/types/dashboard";

// Fixed English names, so the text does not depend on the server's locale.
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SERIES_LENGTH: Record<SeriesRange, number> = { "30d": 30, "14d": 14, "7d": 7 };

// Days between two labels on the X axis of the attendance chart, so the labels do not collide.
const TICK_STEP: Record<SeriesRange, number> = { "30d": 4, "14d": 2, "7d": 1 };

function parts(date: string): { year: number; month: number; day: number; weekday: number } {
  const [year, month, day] = date.split("-").map(Number);

  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

export function formatDayLabel(date: string): string {
  const { month, day, weekday } = parts(date);

  return `${WEEKDAYS[weekday]}, ${day} ${MONTHS[month - 1]}`;
}

export function formatLongDay(date: string): string {
  const { year } = parts(date);

  return `${formatDayLabel(date)} ${year}`;
}

export function formatShortDay(date: string): string {
  const { month, day, weekday } = parts(date);

  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}`;
}

// The X axis label of the attendance chart, as "Nov 9".
export function formatMonthDay(date: string): string {
  const { month, day } = parts(date);

  return `${MONTHS[month - 1]} ${day}`;
}

// The label under a bar of the weekly chart, as "Mon 9".
export function formatWeekdayDay(date: string): string {
  const { day, weekday } = parts(date);

  return `${WEEKDAYS[weekday]} ${day}`;
}

function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function marked(counts: AttendanceCounts): number {
  return counts.present + counts.absent + counts.sick + counts.leave;
}

// Present out of marked, as a percentage with one decimal. Not marked is left out.
export function attendanceRate(counts: AttendanceCounts): number | null {
  const total = marked(counts);

  if (total === 0) {
    return null;
  }

  return oneDecimal((counts.present / total) * 100);
}

// Points between the two rates as they are displayed, so 94.2 against 96.0 is exactly -1.8.
export function rateDelta(today: number | null, yesterday: number | null): number | null {
  if (today === null || yesterday === null) {
    return null;
  }

  return oneDecimal(oneDecimal(today) - oneDecimal(yesterday));
}

function workersCard(role: DashboardRole, kpis: DashboardKpis): KpiCard {
  const delta = kpis.workersToday - kpis.workersYesterday;

  let badge: KpiCard["badge"];
  let comparison: string;

  if (delta > 0) {
    badge = { label: `+${delta}`, tone: "up" };
    comparison = `${delta} more than yesterday`;
  } else if (delta < 0) {
    badge = { label: `-${-delta}`, tone: "down" };
    comparison = `${-delta} fewer than yesterday`;
  } else {
    badge = { label: "0", tone: "neutral" };
    comparison = "Same as yesterday";
  }

  return {
    key: "workers",
    label: "Workers today",
    value: String(kpis.workersToday),
    badge,
    lines: [
      comparison,
      role === "admin_site" ? "Scheduled in the confirmed roster" : "Scheduled in confirmed rosters",
    ],
    danger: false,
  };
}

function attendanceCard(today: AttendanceCounts, yesterday: AttendanceCounts): KpiCard {
  const label = "Attendance today";
  const rate = attendanceRate(today);

  if (rate === null) {
    if (today.scheduled === 0) {
      return {
        key: "attendance",
        label,
        value: "No shifts",
        badge: null,
        lines: ["No one is scheduled today", "Confirmed rosters appear here"],
        danger: false,
      };
    }

    return {
      key: "attendance",
      label,
      value: "Not marked",
      badge: { label: "Pending", tone: "pending" },
      lines: [
        `${today.scheduled} ${plural(today.scheduled, "worker is", "workers are")} waiting`,
        "Mark attendance to fill this in",
      ],
      danger: false,
    };
  }

  const yesterdayRate = attendanceRate(yesterday);
  const delta = rateDelta(rate, yesterdayRate);

  let badge: KpiCard["badge"] = null;
  let comparison = "Nothing marked yesterday";

  if (delta !== null && yesterdayRate !== null) {
    if (delta > 0) {
      badge = { label: `+${delta.toFixed(1)}%`, tone: "up" };
      comparison = `Up from ${yesterdayRate.toFixed(1)}% yesterday`;
    } else if (delta < 0) {
      badge = { label: `${delta.toFixed(1)}%`, tone: "down" };
      comparison = `Down from ${yesterdayRate.toFixed(1)}% yesterday`;
    } else {
      badge = { label: "0.0%", tone: "neutral" };
      comparison = "Same as yesterday";
    }
  }

  const lines = [comparison, "Present out of marked"];
  const notMarked = today.scheduled - marked(today);

  if (notMarked > 0) {
    lines.push(`${notMarked} not marked yet`);
  }

  return {
    key: "attendance",
    label,
    value: `${rate.toFixed(1)}%`,
    badge,
    lines,
    danger: false,
  };
}

function conflictsCard(role: DashboardRole, kpis: DashboardKpis): KpiCard {
  const label = "Open conflicts";

  if (kpis.openConflicts === 0) {
    return {
      key: "conflicts",
      label,
      value: "0",
      badge: { label: "None", tone: "neutral" },
      lines: [
        "No unfilled shifts",
        role === "admin_site"
          ? "The roster for this week is covered"
          : "Every draft roster is fully covered",
      ],
      danger: false,
    };
  }

  const rosters = kpis.conflictedRosters;

  return {
    key: "conflicts",
    label,
    value: String(kpis.openConflicts),
    badge: { label: `${rosters} ${plural(rosters, "roster", "rosters")}`, tone: "danger" },
    lines: [
      "Shifts the rules could not fill",
      rosters === 1 ? "In 1 draft roster, with a reason" : "In draft rosters, each with a reason",
    ],
    danger: true,
  };
}

function approvalsCard(role: DashboardRole, kpis: DashboardKpis): KpiCard {
  const label = "Pending approvals";

  if (kpis.pendingRequests === 0) {
    return {
      key: "approvals",
      label,
      value: "0",
      badge: { label: "Weekly", tone: "neutral" },
      lines: ["No request is waiting", "Every weekly request is decided"],
      danger: false,
    };
  }

  const who = role === "ho" ? "you or a superadmin" : "HO or a superadmin";
  let second = "Weekly requests need an approval";

  if (kpis.oldestPendingDate !== null) {
    const day = formatShortDay(kpis.oldestPendingDate);

    second = kpis.pendingRequests === 1 ? `Requested on ${day}` : `Oldest request is from ${day}`;
  }

  return {
    key: "approvals",
    label,
    value: String(kpis.pendingRequests),
    badge: { label: "Weekly", tone: "pending" },
    lines: [`Waiting for ${who}`, second],
    danger: false,
  };
}

function requestsCard(kpis: DashboardKpis): KpiCard {
  const pending = kpis.requestsThisWeekPending;

  return {
    key: "requests",
    label: "Requests this week",
    value: String(kpis.requestsThisWeek),
    badge:
      pending > 0
        ? { label: `${pending} pending`, tone: "pending" }
        : { label: "None pending", tone: "neutral" },
    lines: [
      pending === 0
        ? "None waiting for HO approval"
        : `${pending} ${plural(pending, "is", "are")} waiting for HO approval`,
      "Only HO or superadmin can approve",
    ],
    danger: false,
  };
}

// Superadmin and HO approve requests, so they see approvals. Admin site follows its own requests.
export function kpiCards(role: DashboardRole, kpis: DashboardKpis): KpiCard[] {
  const workers = workersCard(role, kpis);
  const attendance = attendanceCard(kpis.today, kpis.yesterday);
  const conflicts = conflictsCard(role, kpis);

  if (role === "admin_site") {
    return [workers, attendance, requestsCard(kpis), conflicts];
  }

  return [workers, attendance, conflicts, approvalsCard(role, kpis)];
}

function requestsItem(role: DashboardRole, count: number): AttentionItem {
  const href = "/dashboard/requests?status=pending";

  if (role === "admin_site") {
    return {
      key: "requests",
      title: `${count} ${plural(count, "request is", "requests are")} waiting for HO approval`,
      detail: `You can follow ${plural(count, "its", "their")} status here. Only HO or a superadmin can approve ${plural(count, "it", "them")}.`,
      button: "View request",
      href,
    };
  }

  // The frames word this the same for one request and for many.
  const who = role === "ho" ? "you or a superadmin approve" : "HO or a superadmin approves";

  return {
    key: "requests",
    title: `${count} ${plural(count, "request is", "requests are")} waiting for approval`,
    detail: `Weekly requests stay pending until ${who} them.`,
    button: "Review",
    href,
  };
}

function attendanceItem(counts: AttentionCounts, today: string): AttentionItem {
  const locations = counts.unmarkedLocationIds.length;
  const day = formatLongDay(today);

  const title =
    locations === 1
      ? "Attendance is not marked today"
      : `Attendance is not marked in ${locations} locations today`;

  const detail =
    locations === 1 && counts.unmarkedWorkers > 0
      ? `${day}. ${counts.unmarkedWorkers} ${plural(counts.unmarkedWorkers, "worker in the confirmed roster is", "workers in the confirmed roster are")} waiting to be marked.`
      : `${day}. Confirmed rosters are waiting to be marked.`;

  const href =
    locations === 1
      ? `/dashboard/attendance?location=${encodeURIComponent(counts.unmarkedLocationIds[0])}`
      : "/dashboard/attendance";

  return { key: "attendance", title, detail, button: "Mark attendance", href };
}

// The order of the list, as the frames show it. Admin site starts with its own attendance task.
const ATTENTION_ORDER: Record<DashboardRole, AttentionKey[]> = {
  superadmin: ["requests", "drafts", "conflicts", "attendance", "contracts"],
  ho: ["requests", "drafts", "conflicts", "attendance", "contracts"],
  admin_site: ["attendance", "requests", "drafts", "conflicts", "contracts"],
};

function attentionItem(
  key: AttentionKey,
  role: DashboardRole,
  counts: AttentionCounts,
  today: string,
): AttentionItem | null {
  switch (key) {
    case "requests":
      return counts.pendingRequests > 0 ? requestsItem(role, counts.pendingRequests) : null;
    case "drafts": {
      const drafts = counts.draftRosters;

      return drafts > 0
        ? {
            key,
            title: `${drafts} ${plural(drafts, "roster is still a draft", "rosters are still drafts")}`,
            detail:
              drafts === 1
                ? "Confirm it so attendance can be marked against it."
                : "Confirm a roster so attendance can be marked against it.",
            button: "Open rosters",
            href: "/dashboard/rosters?status=draft",
          }
        : null;
    }
    case "conflicts": {
      const conflicts = counts.conflicts;

      return conflicts > 0
        ? {
            key,
            title: `${conflicts} ${plural(conflicts, "conflict", "conflicts")} in ${counts.conflictedRosters === 1 ? "the draft roster" : "draft rosters"}`,
            detail: "Shifts the rules could not fill, each with its reason.",
            button: "View conflicts",
            href: "/dashboard/rosters?status=draft",
          }
        : null;
    }
    case "attendance":
      return counts.unmarkedLocationIds.length > 0 ? attendanceItem(counts, today) : null;
    case "contracts": {
      const ending = counts.contractsEnding;

      return ending > 0
        ? {
            key,
            title: `${ending} worker ${plural(ending, "contract ends", "contracts end")} within 30 days`,
            detail: "Renew or replace these workers before their end date.",
            button: "View workers",
            href: "/dashboard/workers?ending=1",
          }
        : null;
    }
  }
}

// Only the items with something to do, in the order of the role. An empty list is the All caught
// up state.
export function attentionItems(
  role: DashboardRole,
  counts: AttentionCounts,
  today: string,
): AttentionItem[] {
  return ATTENTION_ORDER[role]
    .map((key) => attentionItem(key, role, counts, today))
    .filter((item): item is AttentionItem => item !== null);
}

// The seven dates of the week that holds `today`, Monday first.
export function weekDays(today: string): string[] {
  const monday = addDays(today, -((parts(today).weekday + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

// The last `count` dates ending on `today`, oldest first.
export function lastDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(today, index - (count - 1)));
}

// The chart loads 30 days once, and a shorter range is the tail of it.
export function sliceSeries(series: SeriesPoint[], range: SeriesRange): SeriesPoint[] {
  return series.slice(-SERIES_LENGTH[range]);
}

// Whole-number ticks from 0 for a chart axis: at most five steps of 1, 2, 5, 10, 20, 50 and so
// on, and never fewer than `minimum` as the top, so an empty chart still has a scale.
export function axisTicks(max: number, minimum: number): number[] {
  const target = Math.max(Math.ceil(max), minimum);

  for (let magnitude = 1; ; magnitude *= 10) {
    for (const factor of [1, 2, 5]) {
      const step = factor * magnitude;
      const count = Math.ceil(target / step);

      if (count <= 5) {
        return Array.from({ length: count + 1 }, (_, index) => index * step);
      }
    }
  }
}

// The dates labelled on the X axis: every Nth date counted back from the last one, oldest first.
export function tickDates(series: SeriesPoint[], range: SeriesRange): string[] {
  const step = TICK_STEP[range];

  return series
    .filter((_, index) => (series.length - 1 - index) % step === 0)
    .map((point) => point.date);
}

export function dashboardSubtitle(
  role: DashboardRole,
  names: { siteName: string | null; locationName: string | null },
): string {
  if (role === "superadmin") {
    return "Everything that needs attention across all sites.";
  }

  if (role === "ho") {
    return `Everything that needs attention at ${names.siteName ?? "your site"}.`;
  }

  const place = [names.siteName, names.locationName].filter(Boolean).join(" / ");

  return `What needs attention at ${place || "your location"}.`;
}

// The title, description, caption and tone of the week chart. Superadmin and HO see the gaps the
// rules left, and an admin site sees how many workers are scheduled.
export function weekChartCopy(role: DashboardRole, kpis: DashboardKpis): WeekChartCopy {
  const conflicts = kpis.openConflicts;
  const count = `${conflicts} ${plural(conflicts, "conflict", "conflicts")}`;

  if (role === "admin_site") {
    return {
      title: "Workers scheduled this week",
      description: "Workers on a shift, per day",
      caption: conflicts === 0 ? "No unfilled shifts this week" : `${count} in the draft roster`,
      tone: "primary",
    };
  }

  const rosters = kpis.conflictedRosters;

  return {
    title: "Gaps in this week's rosters",
    description: "Shifts the rules could not fill, per day",
    caption:
      conflicts === 0
        ? "No unfilled shifts this week"
        : `${count} in ${rosters} ${plural(rosters, "draft roster", "draft rosters")}`,
    tone: "danger",
  };
}
