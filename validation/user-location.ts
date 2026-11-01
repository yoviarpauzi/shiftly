import type { LocationOption } from "@/types/users";

// Reads the location filter from the URL. Only ids from the choices count, so anything else shows every location.
export function parseUserLocation(
  value: string | string[] | undefined,
  locations: LocationOption[],
): string | null {
  const first = Array.isArray(value) ? value[0] : value;

  return locations.some((location) => location.id === first) ? (first as string) : null;
}
