import {
  DEFAULT_PAGE_SIZE,
  MAX_QUERY_LENGTH,
  PAGE_SIZES,
} from "@/lib/pagination";
import type { PageParams, RawParam } from "@/types/pagination";

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
