import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { CTA_FOCUS_CLASS } from "@/components/home/auth-button";
import { HERO_COPY, HERO_WORDS } from "@/components/home/content";
import ProductWindow from "@/components/home/product-window";
import RotatingWord from "@/components/home/rotating-word";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

// The headline for a screen reader, with every rule named. The pill shows one rule at a time.
const HEADLINE = `${HERO_COPY.lead} ${new Intl.ListFormat("en", { type: "conjunction" }).format(HERO_WORDS)}.`;

const BUTTON_CLASS =
  "h-12 w-full rounded-lg px-6 text-base sm:h-[52px] sm:w-auto";

export default function Hero() {
  return (
    <section className="overflow-x-clip pt-10 pb-6 sm:pt-[72px] lg:pb-2.5">
      <div className="container text-center">
        <h1 className="flex flex-col items-center text-[40px] leading-[44px] font-bold tracking-[-0.03em] sm:text-5xl sm:leading-[56px] lg:text-[64px] lg:leading-[68px]">
          <span className="sr-only">{HEADLINE}</span>
          <span aria-hidden="true">{HERO_COPY.lead}</span>
          <RotatingWord words={HERO_WORDS} />
        </h1>

        {/* Who it is for (quiet), what it does (the lede), and what no other tool can say (ticks). */}
        <p className="mx-auto mt-5 max-w-[640px] text-base leading-6 text-pretty text-muted-foreground sm:mt-6">
          {HERO_COPY.audience}
        </p>
        <p className="mx-auto mt-3 max-w-[720px] text-xl leading-8 text-balance text-foreground sm:text-2xl sm:leading-9">
          {HERO_COPY.subtitle}
        </p>
        <ul
          role="list"
          className="mx-auto mt-6 flex w-fit list-none flex-col items-start gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-x-8"
        >
          {HERO_COPY.claims.map((claim) => (
            <li
              key={claim}
              className="flex items-center gap-2.5 text-base leading-6 font-semibold text-foreground"
            >
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
                aria-hidden="true"
              >
                <CheckIcon className="size-3.5" strokeWidth={3} />
              </span>
              {claim}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center">
          <Link
            href="#how-it-works"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              CTA_FOCUS_CLASS,
              BUTTON_CLASS,
            )}
          >
            How it works
          </Link>
        </div>

        <div className="mt-16 sm:mt-24 lg:mt-[118px]">
          <ProductWindow />
        </div>
      </div>
    </section>
  );
}
