const JAKARTA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// The calendar date in Asia/Jakarta as YYYY-MM-DD, whatever the server time zone is.
export function jakartaDate(now: Date = new Date()): string {
  return JAKARTA_DATE.format(now);
}
