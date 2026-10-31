import Image from "next/image";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4 py-12 text-center">
      <div className="rise-in">
        <Image
          src="/illustrations/not-found.svg"
          alt=""
          width={300}
          height={300}
          priority
          className="h-auto w-full max-w-xs"
        />
      </div>
      <div className="rise-in-delay flex max-w-md flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="text-base text-muted-foreground">
          The page you are looking for does not exist or has moved.
        </p>
      </div>
    </main>
  );
}
