const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// A regex alone lets 2026-02-30 through, so the parts go through Date.UTC and must come back unchanged.
export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
