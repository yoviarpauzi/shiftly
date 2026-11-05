import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import type { AuthButtonProps, AuthLinkProps } from "@/types/home";
import { cn } from "cn";

// The stock button ring (3 px, 50% brand) is too faint on white; the spec asks
// for a visible 2 px brand ring. The offset gap uses the page background, and a
// caller on a tinted surface overrides the offset colour through className.
export const CTA_FOCUS_CLASS =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function AuthLink({ href, label, className }: AuthLinkProps) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants(), CTA_FOCUS_CLASS, className)}
    >
      {label}
    </Link>
  );
}

async function SessionAuthLink({ className }: AuthButtonProps) {
  let signedIn = false;
  try {
    signedIn = Boolean(await getCurrentUser());
  } catch (error) {
    // Let Next's own signals (prerender postpone, redirects) pass through. A
    // real failure, such as the database being down, must not turn the whole
    // public page into the error view: the visitor sees the signed-out button.
    unstable_rethrow(error);
  }

  return signedIn ? (
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
