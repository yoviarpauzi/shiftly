"use client";

import Image from "next/image";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { NAV_LINKS } from "@/components/home/content";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { HeaderProps } from "@/types/home";
import { cn } from "cn";

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

export default function Header({ action, mobileAction }: HeaderProps) {
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 0,
    () => false,
  );

  const [menuOpen, setMenuOpen] = useState(false);

  // The section that crosses a thin line a little above the middle of the screen. When two
  // touch it, the lower one wins. Nothing is active over the hero.
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const ids = NAV_LINKS.map((link) => link.href.slice(1));
    const touching = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) touching.add(entry.target.id);
          else touching.delete(entry.target.id);
        }
        setActiveId(ids.filter((id) => touching.has(id)).at(-1) ?? null);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );

    for (const id of ids) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }

    return () => observer.disconnect();
  }, []);

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
          {/* One pill is shared by the three links. It slides to the link of the section in view,
              and under reduced motion it jumps. */}
          <MotionConfig reducedMotion="user">
            <ul className="flex items-center gap-2">
              {NAV_LINKS.map((link) => {
                const active = link.href === `#${activeId}`;

                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "location" : undefined}
                      className={cn(
                        "relative isolate block rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "text-secondary-foreground"
                          : "text-foreground/80 hover:text-foreground",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-0 -z-10 rounded-full bg-secondary"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      ) : null}
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </MotionConfig>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {action}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle className="sr-only">Menu</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="px-1 pt-10">
                <ul className="flex flex-col">
                  {NAV_LINKS.map((link) => {
                    const active = link.href === `#${activeId}`;

                    return (
                      <li key={link.href} className="border-b last:border-b-0">
                        <Link
                          href={link.href}
                          aria-current={active ? "location" : undefined}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "block rounded-lg px-3 py-4 text-lg font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active
                              ? "bg-secondary text-secondary-foreground"
                              : "text-foreground",
                          )}
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <SheetFooter>{mobileAction}</SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
