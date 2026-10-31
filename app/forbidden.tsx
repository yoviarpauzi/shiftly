import Image from "next/image";

export default function Forbidden() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4 py-12 text-center">
      <div className="rise-in">
        <Image
          src="/illustrations/forbidden.svg"
          alt=""
          width={300}
          height={300}
          priority
          className="h-auto w-full max-w-xs"
        />
      </div>
      <div className="rise-in-delay flex max-w-md flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Error 403</p>
        <h1 className="text-3xl font-bold tracking-tight">Access denied</h1>
        <p className="text-base text-muted-foreground">
          Your account does not have permission to view this page.
        </p>
      </div>
    </main>
  );
}
