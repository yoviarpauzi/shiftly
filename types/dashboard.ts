import type { ColumnDef, RowData } from "@tanstack/react-table";
import type { RequestAccess, RequestStatus, RequestType } from "@/types/requests";
import type { summaryFeatures } from "@/components/dashboard/overview/columns";
import type { LocationTimezone } from "@/validation/location";

export type DashboardRole = "superadmin" | "ho" | "admin_site";

export type ScopeLocation = {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  timezone: LocationTimezone;
};

export type ScopeZone = {
  timezone: LocationTimezone;
  // YYYY-MM-DD, the calendar date of today in this zone.
  today: string;
  locationIds: string[];
};

export type DashboardScope = {
  access: RequestAccess;
  locations: ScopeLocation[];
  zones: ScopeZone[];
};

export type AttendanceCounts = {
  // Scheduled shifts, marked or not.
  scheduled: number;
  present: number;
  absent: number;
  sick: number;
  leave: number;
};

export type DashboardKpis = {
  workersToday: number;
  workersYesterday: number;
  today: AttendanceCounts;
  yesterday: AttendanceCounts;
  openConflicts: number;
  conflictedRosters: number;
  pendingRequests: number;
  // YYYY-MM-DD, null when nothing is pending.
  oldestPendingDate: string | null;
  requestsThisWeek: number;
  requestsThisWeekPending: number;
};

export type AttentionCounts = {
  pendingRequests: number;
  draftRosters: number;
  conflicts: number;
  conflictedRosters: number;
  // With the site, because the Attendance page picks a location only inside the chosen site.
  unmarkedLocations: { id: string; siteId: string }[];
  unmarkedWorkers: number;
  contractsEnding: number;
};

export type SeriesPoint = {
  date: string;
  present: number;
  notPresent: number;
};

export type WeekPoint = {
  date: string;
  value: number;
};

// One location's request counts, as the dashboard query groups them.
export type RequestCountRow = {
  locationId: string;
  pending: number;
  // YYYY-MM-DD in the location's zone, null when nothing is pending.
  oldestPending: string | null;
  thisWeek: number;
  thisWeekPending: number;
};

// One location's draft rosters and the conflict rows they hold.
export type DraftCountRow = {
  locationId: string;
  draftRosters: number;
  conflicts: number;
  conflictedRosters: number;
};

export type SeriesRange = "30d" | "14d" | "7d";

export type KpiCard = {
  key: "workers" | "attendance" | "conflicts" | "approvals" | "requests";
  label: string;
  value: string;
  badge: { label: string; tone: "up" | "down" | "neutral" | "pending" | "danger" } | null;
  lines: string[];
  danger: boolean;
};

export type AttentionKey = "requests" | "drafts" | "conflicts" | "attendance" | "contracts";

export type AttentionItem = {
  key: AttentionKey;
  title: string;
  detail: string;
  button: string;
  href: string;
};

export type SiteRow = {
  id: string;
  name: string;
  locations: number;
  workers: number;
  pendingRequests: number;
  draftRosters: number;
  conflicts: number;
};

export type LocationRow = Omit<SiteRow, "locations">;

export type RecentRequestRow = {
  id: string;
  poNumber: string;
  type: RequestType;
  startDate: string;
  status: RequestStatus;
};

export type Breakdown =
  | { kind: "sites"; rows: SiteRow[] }
  | { kind: "locations"; rows: LocationRow[] }
  | { kind: "requests"; rows: RecentRequestRow[] };

export type KpiCardsProps = {
  cards: KpiCard[];
};

export type AttentionListProps = {
  items: AttentionItem[];
};

export type OverviewHeaderProps = {
  role: DashboardRole;
  subtitle: string;
};

export type KpiBadgeTone = NonNullable<KpiCard["badge"]>["tone"];

export type KpiBadgeProps = {
  badge: NonNullable<KpiCard["badge"]>;
};

export type AttentionHeaderProps = {
  count: number;
};

// The view of the attendance chart: one of the ranges, or the table of the last range.
export type AttendanceView = SeriesRange | "table";

export type AttendanceChartProps = {
  // 30 days, oldest first. A shorter range is the tail of it.
  series: SeriesPoint[];
};

export type AttendanceTableProps = {
  series: SeriesPoint[];
};

export type WeekChartTone = "danger" | "primary";

export type WeekChartProps = {
  title: string;
  description: string;
  // Seven days, Monday first.
  points: WeekPoint[];
  tone: WeekChartTone;
  caption: string;
};

export type WeekChartCopy = Omit<WeekChartProps, "points">;

export type EndLabelBounds = {
  top: number;
  bottom: number;
  // The least distance between the two labels.
  gap: number;
};

export type EndLabelYs = {
  present: number;
  notPresent: number;
};

export type AttendanceEndLabelsProps = {
  last: SeriesPoint;
};

export type BreakdownTableProps = {
  breakdown: Breakdown;
  // The site name for HO, the location name for admin site, null for a superadmin.
  contextName: string | null;
};

export type SummaryTableProps<TData extends RowData> = {
  data: TData[];
  columns: ColumnDef<typeof summaryFeatures, TData>[];
  getRowId: (row: TData) => string;
};

export type CountCellProps = {
  value: number;
  // A value above 0 gets the destructive color, for conflicts.
  danger?: boolean;
};

export type NumberHeaderProps = {
  label: string;
};

export type IdentifiedRow = {
  id: string;
};
