import { DepartmentsDataTable } from "@/components/dashboard/departments/data-table";
import { requireDepartmentManager } from "./department-guard";
import { parseDepartmentLocation } from "@/validation/department-location";
import { parseDepartmentSite } from "@/validation/department-site";
import { parseDepartmentStatus } from "@/validation/department-status";
import { parsePageParams } from "@/validation/pagination";
import { parseSortParam } from "@/validation/sort";
import {
  departmentLocationsFor,
  departmentSitesFrom,
} from "./department-rules";
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
  // Only superadmin and HO pick a location, so a location manager gets no site or location filter.
  const choices = locationChoice.mode === "pick" ? locationChoice.locations : [];
  const pickSite = access.siteId === null && access.locationId === null;
  const siteId = parseDepartmentSite(params.site, pickSite ? departmentSitesFrom(choices) : []);
  const locations = departmentLocationsFor(choices, siteId, pickSite);
  const locationId = parseDepartmentLocation(params.location, locations);
  const departments = await listDepartments(access, {
    ...parsePageParams(params),
    status,
    siteId,
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
        pickSite={pickSite}
        siteId={siteId}
        locations={locations}
        locationId={locationId}
        locationChoice={locationChoice}
        sort={sort}
      />
    </div>
  );
}
