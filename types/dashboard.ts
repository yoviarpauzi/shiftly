import type { RequestAccess, RequestStatus, RequestType } from "@/types/requests";
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
  unmarkedLocationIds: string[];
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
