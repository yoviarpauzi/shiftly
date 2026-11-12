import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="flex flex-col gap-2 rounded-lg border p-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
