export const PAGE_SIZES = [10, 20, 30, 40, 50] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const MAX_QUERY_LENGTH = 100;

export type PageParams = {
  page: number;
  pageSize: number;
  query: string;
};

type RawParam = string | string[] | undefined;

function firstValue(value: RawParam) {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePageParams(params: {
  page?: RawParam;
  pageSize?: RawParam;
  q?: RawParam;
}): PageParams {
  const page = Number(firstValue(params.page));
  const pageSize = Number(firstValue(params.pageSize));
  const query = (firstValue(params.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
    query,
  };
}

// Escapes LIKE wildcards so a search for "50%" matches that text, not every row.
export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function clampPage(page: number, total: number, pageSize: number) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return Math.min(page, lastPage);
}
