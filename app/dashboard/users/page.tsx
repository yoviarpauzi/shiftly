import { UsersDataTable } from "@/components/dashboard/users/data-table";
import { requireUserManager } from "./user-guard";
import { listUserChoices, listVisibleUsers } from "./users";
import { parsePageParams } from "@/validation/pagination";
import { parseUserLocation } from "@/validation/user-location";
import { parseUserRole } from "@/validation/user-role";
import { parseUserSite } from "@/validation/user-site";
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
  const choices = await listUserChoices(access);
  // Only superadmin picks a site, so HO gets no site filter.
  const siteId = parseUserSite(
    params.site,
    access.siteId === null ? choices.sites : [],
  );
  // Superadmin picks a site first, so until then there are no locations to filter by. HO has one site,
  // so its locations are listed as they are.
  const locations =
    access.siteId === null && !siteId
      ? []
      : choices.locations.filter((location) => !siteId || location.siteId === siteId);
  const locationId = parseUserLocation(params.location, locations);
  const users = await listVisibleUsers(access, {
    ...parsePageParams(params),
    status,
    role,
    siteId,
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
        siteId={siteId}
        locations={locations}
        locationId={locationId}
      />
    </div>
  );
}
