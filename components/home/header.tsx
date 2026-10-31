import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

function AuthButton({ href, label }: { href: string; label: string }) {
  return (
    <Button
      render={<Link href={href} />}
      nativeButton={false}
      className="h-9 rounded-md px-4"
    >
      {label}
    </Button>
  );
}

async function HeaderAuthButton() {
  const user = await getCurrentUser();

  return user ? (
    <AuthButton href="/dashboard" label="Dashboard" />
  ) : (
    <AuthButton href="/sign-in" label="Sign in" />
  );
}

export default function Header() {
  return (
    <header className="fixed top-0 left-0 w-full z-50 py-4">
      <div className="container">
        <nav className="flex items-center justify-between">
          {/* logo */}
          <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Image
              src="/logo.webp"
              alt="Shiftly logo"
              width={25}
              height={28}
              className="h-7 w-auto"
              priority
            />
            Shiftly
          </span>

          <ul></ul>

          {/* sign-in or dashboard button */}
          <Suspense fallback={<AuthButton href="/sign-in" label="Sign in" />}>
            <HeaderAuthButton />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
