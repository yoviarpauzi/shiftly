"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { NAV_LINKS } from "@/components/home/content";
import type { HeaderProps } from "@/types/home";
import { cn } from "cn";

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

export default function Header({ action }: HeaderProps) {
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 0,
    () => false,
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-16 border-b transition-[background-color,border-color,box-shadow] duration-150 ease-out",
        scrolled
          ? "border-border bg-background shadow-sm"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="container relative flex h-full items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm text-base font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Image
            src="/logo.webp"
            alt=""
            width={25}
            height={28}
            className="h-7 w-auto"
            priority
          />
          Shiftly
        </Link>

        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 md:block"
        >
          <ul className="flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-sm text-sm font-medium text-foreground/80 transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {action}
      </div>
    </header>
  );
}
