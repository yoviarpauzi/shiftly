import Link from "next/link";
import AuthButton from "@/components/home/auth-button";
import { HERO_COPY } from "@/components/home/content";
import ProductWindow from "@/components/home/product-window";
import { Button } from "@/components/ui/button";

const BUTTON_CLASS =
  "h-12 w-full rounded-xl px-6 text-[17px] sm:h-[52px] sm:w-auto sm:text-[18px]";

export default function Hero() {
  return (
    <section className="overflow-x-clip pt-10 pb-16 sm:pt-[72px] md:pb-24 lg:pb-[120px]">
      <div className="home-container text-center">
        <h1 className="flex flex-wrap items-center justify-center gap-x-[0.25em] text-[52px] leading-[56px] font-bold tracking-[-0.03em] sm:text-[72px] sm:leading-[78px] lg:text-[88px] lg:leading-[96px]">
          <span>{HERO_COPY.lead}</span>
          <span className="inline-flex items-center gap-[0.18em] rounded-full bg-secondary px-[0.27em] py-[0.04em]">
            <span
              className="size-[0.5em] shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className="text-foreground">{HERO_COPY.highlight}</span>
          </span>
          <span>{HERO_COPY.tail}</span>
        </h1>

        <p className="mx-auto mt-6 max-w-[740px] text-[17px] leading-[26px] text-muted-foreground sm:mt-8 sm:text-[22px] sm:leading-8">
          {HERO_COPY.subtitle}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:justify-center">
          <AuthButton className={BUTTON_CLASS} />
          <Button
            variant="secondary"
            render={<Link href="#how-it-works" />}
            nativeButton={false}
            className={BUTTON_CLASS}
          >
            How it works
          </Button>
        </div>

        <div className="mt-16 sm:mt-24 lg:mt-[118px]">
          <ProductWindow />
        </div>
      </div>
    </section>
  );
}

