// Reads the location filter from the URL. Only ids from the options count, so anything else shows every location.
export function parseShiftLocation(
  value: string | string[] | undefined,
  options: { id: string }[],
): string | null {
  const first = Array.isArray(value) ? value[0] : value;

  return options.some((option) => option.id === first) ? (first as string) : null;
}
