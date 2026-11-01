import { DepartmentsDataTable } from "@/components/dashboard/departments/data-table";
import { requireDepartmentManager } from "./department-guard";
import { parseDepartmentLocation } from "@/validation/department-location";
import { parseDepartmentStatus } from "@/validation/department-status";
import { parsePageParams } from "@/validation/pagination";
import { parseSortParam } from "@/validation/sort";
import { departmentLocationChoiceFor, listDepartments } from "./departments";

const DEPARTMENT_SORT_COLUMNS = ["name", "location", "status"] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireDepartmentManager();

  const params = await searchParams;
  const status = parseDepartmentStatus(params.status);
  const sort = parseSortParam(params.sort, DEPARTMENT_SORT_COLUMNS);
  const locationChoice = await departmentLocationChoiceFor(access);
  // Only superadmin and HO pick a location, so a location manager gets no location filter.
  const locationId = parseDepartmentLocation(
    params.location,
    locationChoice.mode === "pick" ? locationChoice.locations : [],
  );
  const departments = await listDepartments(access, {
    ...parsePageParams(params),
    status,
    locationId,
    sort,
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Departments</h1>
        <p className="text-sm text-muted-foreground">
          Departments in the locations you can manage.
        </p>
      </div>
      <DepartmentsDataTable
        data={departments}
        status={status}
        locationId={locationId}
        locationChoice={locationChoice}
        sort={sort}
      />
    </div>
  );
}
