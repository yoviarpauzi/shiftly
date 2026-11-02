import type { LocationTimezone } from "@/validation/location";

// One record keyed by zone, so a new zone is a compile error until it has a label.
const TIMEZONE_LABELS: Record<LocationTimezone, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

export function timezoneLabel(zone: LocationTimezone): string {
  return TIMEZONE_LABELS[zone];
}

export function timezoneOptionLabel(zone: LocationTimezone): string {
  return `${TIMEZONE_LABELS[zone]} (${zone})`;
}
