import Image from "next/image";
import Link from "next/link";
import { SignInForm } from "@/components/sign-in-form";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-md text-base font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Image
          src="/logo.webp"
          alt=""
          width={203}
          height={230}
          className="h-8 w-auto"
        />
        Shiftly
      </Link>
      <Card className="w-full max-w-sm overflow-hidden p-0 md:max-w-4xl">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="flex flex-col justify-center p-6 md:p-8">
            <SignInForm />
          </div>
          <div className="hidden flex-col items-center justify-center gap-8 bg-secondary p-8 md:flex">
            <Image
              src="/illustration-workers.png"
              alt="Illustrated employee profile cards"
              width={554}
              height={554}
              priority
              className="h-auto w-full max-w-xs"
            />
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight text-secondary-foreground">
                Rosters that follow the rules.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Shiftly builds each location&apos;s roster and records any rule
                it cannot meet, with the reason.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
