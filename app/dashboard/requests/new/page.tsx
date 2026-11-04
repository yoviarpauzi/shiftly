import { Suspense } from "react";
import { RequestForm } from "@/components/dashboard/requests/request-form";
import { RequestFormSkeleton } from "@/components/dashboard/requests/request-form-skeleton";
import { requireRequestUser } from "../request-guard";
import { requestChoicesFor } from "../requests";

async function NewRequest() {
  const { access } = await requireRequestUser();
  const choices = await requestChoicesFor(access);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">New request</h1>
        <p className="text-sm text-muted-foreground">
          Ask for workers by department, position, and shift. The PO number is issued on save.
        </p>
      </div>
      <RequestForm request={null} choices={choices} readOnly={false} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<RequestFormSkeleton />}>
      <NewRequest />
    </Suspense>
  );
}
