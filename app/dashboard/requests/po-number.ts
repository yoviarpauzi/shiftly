import { dateInZone } from "@/lib/indonesia-date";
import type { LocationTimezone } from "@/validation/location";

// YYYYMM of the creation moment in the location's time zone, not of the request date.
export function poPeriod(now: Date, timeZone: LocationTimezone): string {
  return dateInZone(timeZone, now).slice(0, 7).replace("-", "");
}

// The sequence is padded to 4 digits and grows past 9999 without a cap.
export function formatPoNumber(code: string, period: string, sequence: number): string {
  return `PO-${code}-${period}-${String(sequence).padStart(4, "0")}`;
}
