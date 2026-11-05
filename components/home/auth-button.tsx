import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import type { AuthButtonProps } from "@/types/home";
import { cn } from "cn";

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
    <Link href={href} className={cn(buttonVariants(), className)}>
      {label}
    </Link>
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
