import { jakartaDate } from "@/lib/indonesia-date";

// YYYYMM of the creation moment in Asia/Jakarta, not of the request date.
export function poPeriod(now: Date): string {
  return jakartaDate(now).slice(0, 7).replace("-", "");
}

// The sequence is padded to 4 digits and grows past 9999 without a cap.
export function formatPoNumber(code: string, period: string, sequence: number): string {
  return `PO-${code}-${period}-${String(sequence).padStart(4, "0")}`;
}
