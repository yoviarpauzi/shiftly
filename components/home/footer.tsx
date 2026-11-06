import Image from "next/image";
import Link from "next/link";
import { FOOTER_COPY, NAV_LINKS } from "@/components/home/content";

const LINK_CLASS =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-sm leading-5 text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default function Footer() {
  return (
    <footer className="border-t bg-background py-8 md:py-10">
      <div className="container flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Image
              src="/logo.webp"
              alt=""
              width={25}
              height={28}
              className="h-6 w-auto"
            />
            Shiftly
          </span>
          <p className="max-w-[360px] text-sm leading-5 text-muted-foreground">
            {FOOTER_COPY.tagline}
          </p>
        </div>
        <div className="flex flex-col gap-1 md:items-end">
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-5 md:justify-end">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={LINK_CLASS}>
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="#top" className={LINK_CLASS}>
                  Back to top
                </Link>
              </li>
            </ul>
          </nav>
          <p className="text-[13px] leading-5 text-muted-foreground">
            {FOOTER_COPY.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
