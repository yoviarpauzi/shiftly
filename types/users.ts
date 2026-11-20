import type { db } from "@/lib/db";
import type { PageParams } from "@/types/pagination";
import type { AppRole } from "@/types/roles";

export type UserScope = {
  id: string;
  role?: string | null;
  locationId?: string | null;
};

export type UserAccess = {
  id: string;
  role: "ho";
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  locationId: string | null;
  locationName: string | null;
};

export type UserStatusFilter = "all" | "active" | "banned";

export type UserRoleFilter = "all" | AppRole;

export type UserListParams = PageParams & {
  status: UserStatusFilter;
  role: UserRoleFilter;
  // null means every location.
  locationId: string | null;
};

export type UserPage = {
  rows: ManagedUser[];
  total: number;
  page: number;
  pageSize: number;
};

export type ManagedTarget = {
  id: string;
  role: string | null;
  banned: boolean;
};

export type LocationOption = { id: string; name: string };

// Every active location.
export type UserChoices = { locations: LocationOption[] };

export type UserField = "name" | "email" | "password" | "role" | "locationId";

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
export type Scope = { role: AppRole; locationId: string | null };

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type UserActions = {
  onEdit: (user: ManagedUser) => void;
  // Opens the dialog that deactivates the user, or reactivates when user.banned is true.
  onChangeStatus: (user: ManagedUser) => void;
};
