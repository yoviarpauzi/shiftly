export const PAGE_SIZES = [10, 20, 30, 40, 50] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const MAX_QUERY_LENGTH = 100;

// Escapes LIKE wildcards so a search for "50%" matches that text, not every row.
export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function clampPage(page: number, total: number, pageSize: number) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return Math.min(page, lastPage);
}
