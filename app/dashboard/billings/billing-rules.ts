import { dateInZone } from "@/lib/indonesia-date";
import type {
  BillableDay,
  BillingFormErrors,
  BillingGroups,
  BillingLocationChoice,
  BillingLineView,
  BillingMode,
  BillingPoGroup,
} from "@/types/billings";

export const BILLING_NOT_FOUND_MESSAGE = "Billing not found";
export const NOT_DRAFT_MESSAGE = "Only a draft billing can be changed";
export const NOT_ISSUED_MESSAGE = "Only an issued billing can be voided";
export const STALE_BILLING_MESSAGE = "This billing changed since you opened it. Reload and try again";
export const NOTHING_TO_BILL_MESSAGE = "Nothing to bill in this period";
export const CLAIM_COLLISION_MESSAGE =
  "Some days were billed by another billing. Reload and try again";
export const NUMBER_IN_USE_MESSAGE =
  "This billing number is already in use. Ask an administrator to check the site code";
export const BILLED_ATTENDANCE_MESSAGE =
  "This day is part of an issued billing. Void the billing to change it";

export const BILLING_MODE_LABELS: Record<BillingMode, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  custom: "Custom",
};

const UNIQUE_VIOLATION_CODE = "23505";
const CLAIM_CONSTRAINT = "billing_attendance_pkey";
const NUMBER_CONSTRAINT = "billing_number_unique";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byLine(a: BillingLineView, b: BillingLineView): number {
  return (
    byText(a.departmentName.toLowerCase(), b.departmentName.toLowerCase()) ||
    byText(a.subDepartmentName?.toLowerCase() ?? "", b.subDepartmentName?.toLowerCase() ?? "") ||
    byText(a.positionName.toLowerCase(), b.positionName.toLowerCase())
  );
}

// One line per request, department, sub-department and position, with the number of worker-days.
// Lines are ordered by department, then sub-department (none first), then position, ignoring case.
export function groupBillableDays(
  days: Pick<BillableDay, Exclude<keyof BillableDay, "attendanceId">>[],
): BillingGroups {
  const lines = new Map<string, BillingLineView>();

  for (const day of days) {
    const key = [day.requestId, day.departmentId, day.subDepartmentId ?? "", day.positionId].join("|");
    const line = lines.get(key);

    if (line) {
      line.days += 1;
    } else {
      lines.set(key, { ...day, days: 1 });
    }
  }

  const pos = new Map<string, BillingPoGroup>();

  for (const line of [...lines.values()].sort(byLine)) {
    const group = pos.get(line.requestId);

    if (group) {
      group.lines.push(line);
      group.subtotal += line.days;
    } else {
      pos.set(line.requestId, {
        requestId: line.requestId,
        poNumber: line.poNumber,
        lines: [line],
        subtotal: line.days,
      });
    }
  }

  return {
    pos: [...pos.values()].sort((a, b) => byText(a.poNumber, b.poNumber)),
    totalDays: days.length,
  };
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);

  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

// "2026-11-01" and "2026-11-30" as "1 Nov 2026 to 30 Nov 2026". Fixed English names, so the text
// does not change with the browser's locale.
export function formatBillingPeriod(from: string, to: string): string {
  return from === to ? formatDate(from) : `${formatDate(from)} to ${formatDate(to)}`;
}

// The day a billing was issued, as "19 Nov 2026" in Jakarta time. The zone is fixed, so the server
// and the browser print the same text. A billing that was never issued shows a dash.
export function formatBillingIssuedAt(iso: string | null): string {
  if (iso === null) {
    return "-";
  }

  const date = dateInZone("Asia/Jakarta", new Date(iso));

  return formatDate(date);
}

// Drizzle wraps driver errors, so the PostgreSQL error can sit on `cause`. True only for a unique
// violation (23505) on the named constraint, so one collision is never reported as another.
function isUniqueViolationOn(error: unknown, constraintName: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const { code, constraint, cause } = error as {
    code?: unknown;
    constraint?: unknown;
    cause?: unknown;
  };

  return (
    (code === UNIQUE_VIOLATION_CODE && constraint === constraintName) ||
    isUniqueViolationOn(cause, constraintName)
  );
}

// Another billing already holds one of the days (the primary key on billing_attendance).
export function isClaimCollision(error: unknown): boolean {
  return isUniqueViolationOn(error, CLAIM_CONSTRAINT);
}

// Another billing already has this number (the unique index on billing.number).
export function isNumberCollision(error: unknown): boolean {
  return isUniqueViolationOn(error, NUMBER_CONSTRAINT);
}

// Keeps the first message for each field, so the form shows one error per field.
export function billingFormErrors(
  issues: { path: PropertyKey[]; message: string }[],
): BillingFormErrors {
  const errors: BillingFormErrors = {};

  for (const issue of issues) {
    const field = String(issue.path[0]);

    if (field === "locationId" || field === "period") {
      errors[field] ??= issue.message;
    }
  }

  return errors;
}

// The locations the form lists. The site name is added only when more than one site is possible.
export function billingLocationChoices(
  sites: { id: string; name: string }[],
  locations: { id: string; name: string; siteId: string }[],
): BillingLocationChoice[] {
  const siteNames = new Map(sites.map((row) => [row.id, row.name]));

  return locations.map((row) => ({
    id: row.id,
    name: row.name,
    siteName: sites.length > 1 ? (siteNames.get(row.siteId) ?? null) : null,
  }));
}
