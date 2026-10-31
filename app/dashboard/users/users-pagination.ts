export const PAGE_SIZES = [10, 20, 30, 40, 50] as const;

export const DEFAULT_PAGE_SIZE = 10;

export type UsersPageParams = {
  page: number;
  pageSize: number;
};

type RawParam = string | string[] | undefined;

function firstValue(value: RawParam) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseUsersPageParams(params: {
  page?: RawParam;
  pageSize?: RawParam;
}): UsersPageParams {
  const page = Number(firstValue(params.page));
  const pageSize = Number(firstValue(params.pageSize));

  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
  };
}

export function clampPage(page: number, total: number, pageSize: number) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return Math.min(page, lastPage);
}
