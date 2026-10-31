import { UsersDataTable } from "@/components/dashboard/users/data-table";
import { requireUser } from "@/lib/session";
import { listVisibleUsers } from "./users";
import { parsePageParams } from "@/lib/pagination";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requireUser();
  const users = await listVisibleUsers(
    currentUser,
    parsePageParams(await searchParams),
  );

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage user accounts for the dashboard.
        </p>
      </div>
      <UsersDataTable data={users} />
    </div>
  );
}
