// The sequence is padded to 4 digits and grows past 9999 without a cap.
export function formatBillingNumber(code: string, period: string, sequence: number): string {
  return `BL-${code}-${period}-${String(sequence).padStart(4, "0")}`;
}
