import type { db } from "@/lib/db";
import type { SiteOption } from "@/types/locations";
import type { AppRole } from "@/types/roles";

export type UserScope = {
  id: string;
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
};

// siteId null means every site.
export type UserAccess = {
  id: string;
  role: "superadmin" | "ho";
  siteId: string | null;
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  siteId: string | null;
  siteName: string | null;
  locationId: string | null;
  locationName: string | null;
};

export type UserPage = {
  rows: ManagedUser[];
  total: number;
  page: number;
  pageSize: number;
};

// siteId is the target's own site_id. locationSiteId is the site_id of the target's location.
export type ManagedTarget = {
  id: string;
  role: string | null;
  siteId: string | null;
  locationSiteId: string | null;
  banned: boolean;
};

export type LocationOption = { id: string; name: string; siteId: string; siteName: string };

// For HO, sites holds only HO's own site and locations holds only locations in it.
export type UserChoices = { sites: SiteOption[]; locations: LocationOption[] };

export type UserField = "name" | "email" | "password" | "role" | "siteId" | "locationId";

export type UserActionResult =
  | { ok: true }
  | { ok: false; formError?: string; fieldErrors?: Partial<Record<UserField, string>> };

export type UserFormDialogProps = {
  user: ManagedUser | null;
  access: UserAccess;
  choices: UserChoices;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// The dialog reactivates when user.banned is true.
export type DeactivateUserDialogProps = {
  user: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
};

// The role and place a user is assigned to.
export type Scope = { role: AppRole; siteId: string | null; locationId: string | null };

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type UserActions = {
  onEdit: (user: ManagedUser) => void;
  // Opens the dialog that deactivates the user, or reactivates when user.banned is true.
  onChangeStatus: (user: ManagedUser) => void;
};
