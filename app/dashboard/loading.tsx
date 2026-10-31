import { Skeleton } from "@/components/ui/skeleton";

// Mirrors app/dashboard/page.tsx: four summary cards, a chart, then a table.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:px-6 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <div className="flex flex-col gap-2 px-4 lg:px-6">
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="flex flex-col gap-2 rounded-lg border p-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
