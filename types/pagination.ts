export type PageParams = {
  page: number;
  pageSize: number;
  query: string;
};

export type RawParam = string | string[] | undefined;

export type TablePaginationProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};
