import { UsersDataTable } from "@/components/dashboard/users/data-table";
import { requireUserManager } from "@/lib/session";
import { listUserChoices, listVisibleUsers } from "./users";
import { parsePageParams } from "@/lib/pagination";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireUserManager();
  const [users, choices] = await Promise.all([
    listVisibleUsers(access, parsePageParams(await searchParams)),
    listUserChoices(access),
  ]);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage user accounts for the dashboard.
        </p>
      </div>
      <UsersDataTable data={users} access={access} choices={choices} />
    </div>
  );
}
