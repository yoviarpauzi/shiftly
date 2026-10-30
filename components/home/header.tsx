import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

          {/* sign-in button */}
          <Button
            render={<Link href="/sign-in" />}
            nativeButton={false}
            className="h-9 rounded-md px-4"
          >
            Sign in
          </Button>
        </nav>
      </div>
    </header>
  );
}
