import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="@container/card">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <CardAction>
                <Skeleton className="h-5 w-14 rounded-full" />
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48" />
            </CardFooter>
          </Card>
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Card className="@container/card">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
            <CardAction>
              <Skeleton className="h-8 w-40 rounded-md" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-62.5 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-4 lg:px-6">
          <Skeleton className="h-8 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        <div className="flex flex-col gap-4 px-4 lg:px-6">
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center gap-4 bg-muted px-4 py-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-32 md:block" />
              <Skeleton className="h-4 w-24" />
            </div>
            {Array.from({ length: 10 }, (_, index) => (
              <div
                key={index}
                className="flex items-center gap-4 border-t px-4 py-3"
              >
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="hidden h-4 w-32 md:block" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-4">
            <Skeleton className="hidden h-4 w-40 lg:block" />
            <div className="flex w-full items-center gap-8 lg:w-fit">
              <Skeleton className="hidden h-8 w-20 lg:block" />
              <Skeleton className="h-4 w-20" />
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Skeleton className="size-8" />
                <Skeleton className="size-8" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
