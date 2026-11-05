import Image from "next/image";
import { FOOTER_COPY } from "@/components/home/content";

export default function Footer() {
  return (
    <footer className="border-t bg-background py-8 md:py-10">
      <div className="home-container flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
        <div className="flex flex-col gap-1 md:max-w-[440px] md:text-right">
          <p className="text-sm leading-5 text-muted-foreground">
            {FOOTER_COPY.tagline}
          </p>
          <p className="text-[13px] leading-5 text-muted-foreground">
            {FOOTER_COPY.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
