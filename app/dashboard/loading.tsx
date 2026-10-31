import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-[250px] w-full rounded-xl" />
      </div>
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    </div>
  );
}
