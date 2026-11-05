import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import type { AuthButtonProps } from "@/types/home";

function AuthLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Button
      render={<Link href={href} />}
      nativeButton={false}
      className={className}
    >
      {label}
    </Button>
  );
}

async function SessionAuthLink({ className }: AuthButtonProps) {
  const user = await getCurrentUser();

  return user ? (
    <AuthLink href="/dashboard" label="Dashboard" className={className} />
  ) : (
    <AuthLink href="/sign-in" label="Sign in" className={className} />
  );
}

// The only part of the landing page that depends on the visitor. Everything
// around it stays static, and the fallback is the signed-out label.
export default function AuthButton({ className }: AuthButtonProps) {
  return (
    <Suspense
      fallback={
        <AuthLink href="/sign-in" label="Sign in" className={className} />
      }
    >
      <SessionAuthLink className={className} />
    </Suspense>
  );
}
