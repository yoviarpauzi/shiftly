import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-20" />
            </CardHeader>
            <div className="flex flex-col gap-2 px-(--card-spacing)">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </CardHeader>
        <div className="px-(--card-spacing)">
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:gap-6 @4xl/main:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <div className="overflow-hidden rounded-lg border">
          <div className="bg-muted px-4 py-3">
            <Skeleton className="h-4 w-full" />
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="border-t px-4 py-3">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
