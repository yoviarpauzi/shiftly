import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EditDepartmentButton } from "@/components/dashboard/departments/edit-department-button";
import { SubDepartmentTable } from "@/components/dashboard/departments/sub-department-table";
import { Skeleton } from "@/components/ui/skeleton";
import { requireDepartmentManager } from "../department-guard";
import {
  departmentLocationChoiceFor,
  getDepartment,
  listSubDepartments,
} from "../departments";

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

async function DepartmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireDepartmentManager();

  const { id } = await params;
  // getDepartment is scoped and active only. It is the only scope check on this page,
  // so listSubDepartments (which takes just an id) must never run before it passes.
  const department = await getDepartment(access, id);

  if (!department) {
    notFound();
  }

  const [locationChoice, subDepartments] = await Promise.all([
    departmentLocationChoiceFor(access),
    listSubDepartments(department.id),
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
      <SubDepartmentTable departmentId={department.id} rows={subDepartments} />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<DepartmentDetailSkeleton />}>
      <DepartmentDetail params={params} />
    </Suspense>
  );
}
