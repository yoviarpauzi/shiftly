export type UserScope = {
  id: string;
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
};

export type UserPage = {
  rows: ManagedUser[];
  total: number;
  page: number;
  pageSize: number;
};
