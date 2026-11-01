import { Skeleton } from "@/components/ui/skeleton";

// Placeholder for the page area. Used inside the dashboard layout, which already draws the sidebar and header.
export function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Skeleton className="h-9 w-full max-w-sm" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// Placeholder for the whole dashboard shell. Used before the layout has loaded the signed-in user.
export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden w-72 shrink-0 flex-col gap-3 p-4 md:flex">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-12 items-center border-b px-4">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <Skeleton className="h-9 w-full max-w-sm" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
