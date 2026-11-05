import Link from "next/link";
import AuthButton, { CTA_FOCUS_CLASS } from "@/components/home/auth-button";
import { HERO_COPY, HERO_WORDS } from "@/components/home/content";
import ProductWindow from "@/components/home/product-window";
import RotatingWord from "@/components/home/rotating-word";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

const BUTTON_CLASS =
  "h-12 w-full rounded-lg px-6 text-[17px] sm:h-[52px] sm:w-auto sm:text-[18px]";

export default function Hero() {
  return (
    <section className="overflow-x-clip pt-10 pb-6 sm:pt-[72px] lg:pb-2.5">
      <div className="container text-center">
        <h1 className="flex flex-col items-center text-[46px] leading-[50px] font-bold tracking-[-0.03em] min-[360px]:text-[52px] min-[360px]:leading-[56px] sm:text-[72px] sm:leading-[78px] lg:text-[88px] lg:leading-[96px]">
          <span>{HERO_COPY.lead}</span>
          <span className="flex flex-wrap items-center justify-center gap-x-[0.25em]">
            <RotatingWord words={HERO_WORDS} />
            <span>{HERO_COPY.tail}</span>
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-[740px] text-[17px] leading-[26px] text-muted-foreground sm:mt-7 sm:text-[22px] sm:leading-8">
          {HERO_COPY.subtitle}
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:justify-center">
          <AuthButton className={BUTTON_CLASS} />
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
