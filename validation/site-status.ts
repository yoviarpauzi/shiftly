import type { SiteStatus } from "@/types/sites";

export const SITE_STATUSES = ["active", "deleted", "all"] as const satisfies readonly SiteStatus[];

// Reads the status filter from the URL. Anything missing or unknown shows all sites.
export function parseSiteStatus(value: string | string[] | undefined): SiteStatus {
  const first = Array.isArray(value) ? value[0] : value;

  return (SITE_STATUSES as readonly string[]).includes(first ?? "")
    ? (first as SiteStatus)
    : "all";
}
