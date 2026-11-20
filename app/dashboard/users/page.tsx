import { UsersDataTable } from "@/components/dashboard/users/data-table";
import { requireUserManager } from "./user-guard";
import { listUserChoices, listVisibleUsers } from "./users";
import { parsePageParams } from "@/validation/pagination";
import { parseUserLocation } from "@/validation/user-location";
import { parseUserRole } from "@/validation/user-role";
import { parseUserStatus } from "@/validation/user-status";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireUserManager();

  const params = await searchParams;
  const status = parseUserStatus(params.status);
  const role = parseUserRole(params.role);
  const choices = await listUserChoices();
  const locationId = parseUserLocation(params.location, choices.locations);
  const users = await listVisibleUsers(access, {
    ...parsePageParams(params),
    status,
    role,
    locationId,
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage user accounts for the dashboard.
        </p>
      </div>
      <UsersDataTable
        data={users}
        access={access}
        choices={choices}
        status={status}
        role={role}
        locationId={locationId}
      />
    </div>
  );
}
