import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EditDepartmentButton } from "@/components/dashboard/departments/edit-department-button";
import { SubDepartmentTable } from "@/components/dashboard/departments/sub-department-table";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDepartmentId } from "@/validation/department-id";
import { parseDepartmentStatus } from "@/validation/department-status";
import { parsePageParams } from "@/validation/pagination";
import { parseSortParam } from "@/validation/sort";
import { requireDepartmentManager } from "../department-guard";
import {
  departmentLocationChoiceFor,
  getDepartment,
  listSubDepartments,
} from "../departments";

const SUB_DEPARTMENT_SORT_COLUMNS = ["name", "status"] as const;

function DepartmentDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function DepartmentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireDepartmentManager();

  const { id } = await params;

  // A malformed id would make the uuid comparison throw in Postgres, so it is a 404 instead.
  if (!parseDepartmentId(id)) {
    notFound();
  }

  // getDepartment is scoped and active only. It gives the 404 for a missing or out-of-scope id,
  // so no data call runs before it passes. listSubDepartments also applies the scope itself.
  const department = await getDepartment(access, id);

  if (!department) {
    notFound();
  }

  const query = await searchParams;
  const status = parseDepartmentStatus(query.status);
  const sort = parseSortParam(query.sort, SUB_DEPARTMENT_SORT_COLUMNS);

  const [locationChoice, subDepartments] = await Promise.all([
    departmentLocationChoiceFor(access),
    listSubDepartments(access, department.id, {
      ...parsePageParams(query),
      status,
      sort,
    }),
  ]);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{department.name}</h1>
          <p className="text-sm text-muted-foreground">in {department.locationName}</p>
        </div>
        <EditDepartmentButton department={department} locationChoice={locationChoice} />
      </div>
      <SubDepartmentTable
        departmentId={department.id}
        data={subDepartments}
        status={status}
        sort={sort}
      />
    </div>
  );
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<DepartmentDetailSkeleton />}>
      <DepartmentDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}
