import { parsePageParams, type PageParams } from "../../../lib/pagination";

export {
  PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  MAX_QUERY_LENGTH,
  escapeLikePattern,
  clampPage,
} from "../../../lib/pagination";

export type UsersPageParams = PageParams;

export const parseUsersPageParams = parsePageParams;
