import Image from "next/image";
import { HOW_IT_WORKS, STEPS } from "@/components/home/content";
import { cn } from "cn";

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-muted py-14 sm:py-24">
      <div className="container">
        <div className="text-center">
          <h2 className="text-[34px] text-balance leading-10 font-bold tracking-[-0.03em] sm:text-[44px] sm:leading-[52px] lg:text-[56px] lg:leading-[62px]">
            {HOW_IT_WORKS.title}
          </h2>
          <p className="mx-auto mt-2.5 max-w-[920px] text-base text-balance leading-6 text-muted-foreground lg:text-lg lg:leading-7">
            {HOW_IT_WORKS.subtitle}
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-5 sm:mt-12 sm:gap-10 lg:flex-row lg:items-center lg:gap-16">
          <div className="relative w-full shrink-0 lg:w-[380px]">
            {/* The line sits beside the ol, not inside it (an ol may only hold li).
                It runs from the first circle's centre to the last one's:
                top and bottom 22 = row padding 8 + half the 28 px circle;
                left 13 = circle centre 14 minus half the 2 px line.
                Change these with the circle size or the li padding. The li are
                relative and come later, so their circles paint over the line. */}
            <span
              className="absolute top-[22px] bottom-[22px] left-[13px] w-0.5 bg-border"
              aria-hidden="true"
            />
            <ol role="list" className="flex list-none flex-col gap-3.5">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative flex gap-4 py-2">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] leading-4 font-medium",
                      step.active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p
                      className={cn(
                        "text-base leading-6 font-medium",
                        step.active
                          ? "text-secondary-foreground"
                          : "text-foreground",
                      )}
                    >
                      {step.title}
                    </p>
                    {step.detail ? (
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">
                        {step.detail}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mx-auto w-full max-w-[756px] overflow-hidden rounded-xl border bg-background shadow-[0_24px_64px_-24px] shadow-primary/30">
            <Image
              src="/landing/roster-screen.webp"
              alt="A weekly draft roster with unfilled shifts and their conflicts listed."
              width={1512}
              height={1120}
              sizes="(min-width: 1264px) 756px, (min-width: 1024px) calc(100vw - 508px), (min-width: 640px) min(756px, calc(100vw - 4rem)), calc(100vw - 2.5rem)"
              className="block h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
