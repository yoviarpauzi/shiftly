import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ErrorView({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4 py-12 text-center">
      <div className="rise-in">
        <Image
          src="/illustrations/error.svg"
          alt=""
          width={300}
          height={300}
          priority
          className="h-auto w-full max-w-xs"
        />
      </div>
      <div className="rise-in-delay flex max-w-md flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-base text-muted-foreground">
          An unexpected error stopped this page from loading. Try again, or go
          back to the dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Error code: {error.digest}
          </p>
        )}
      </div>
      <div className="rise-in-delay flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <Button
          variant="secondary"
          render={<Link href="/dashboard" />}
          nativeButton={false}
        >
          Go to dashboard
        </Button>
      </div>
    </main>
  );
}
