// Reads the site filter from the URL. Only ids from the choices count, so anything else shows every site.
export function parseShiftSite(
  value: string | string[] | undefined,
  sites: { id: string }[],
): string | null {
  const first = Array.isArray(value) ? value[0] : value;

  return sites.some((site) => site.id === first) ? (first as string) : null;
}
