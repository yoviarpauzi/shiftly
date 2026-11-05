import Image from "next/image";
import DashboardVideo from "@/components/home/dashboard-video";
import { HOW_IT_WORKS, STEPS } from "@/components/home/content";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

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

        <Tabs
          defaultValue="0"
          orientation="vertical"
          className="mt-7 flex-col gap-5 sm:mt-12 sm:gap-10 lg:flex-row lg:items-center lg:gap-16"
        >
          <div className="relative w-full shrink-0 lg:w-[380px]">
            {/* The line sits beside the list, not inside it.
                It runs from the first circle's centre to the last one's:
                top and bottom 22 = row padding 8 + half the 28 px circle;
                left 13 = circle centre 14 minus half the 2 px line.
                Change these with the circle size or the tab padding. The tabs
                are relative and come later, so their circles paint over the line. */}
            <span
              className="absolute top-[22px] bottom-[22px] left-[13px] w-0.5 bg-border"
              aria-hidden="true"
            />
            <TabsList
              variant="line"
              activateOnFocus
              aria-label="How it works"
              className="w-full items-stretch gap-3.5 p-0"
            >
              {STEPS.map((step, index) => (
                <TabsTrigger
                  key={step.title}
                  value={String(index)}
                  className="group/step h-auto flex-none cursor-pointer items-start gap-4 rounded-sm border-0 px-0 py-2 text-left font-normal whitespace-normal after:hidden data-active:bg-transparent"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-[13px] leading-4 font-medium text-muted-foreground transition-colors duration-150 group-data-active/step:border-primary group-data-active/step:bg-primary group-data-active/step:text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 pt-0.5">
                    <span className="block text-base leading-6 font-medium text-foreground transition-colors duration-150 group-data-active/step:text-secondary-foreground">
                      {step.title}
                    </span>
                    <span className="mt-1 hidden text-sm leading-5 text-muted-foreground group-data-active/step:block">
                      {step.detail}
                    </span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {STEPS.map((step, index) => (
            <TabsContent
              key={step.title}
              value={String(index)}
              className="mx-auto w-full max-w-[756px] min-w-0 flex-initial"
            >
              <div className="relative overflow-hidden rounded-xl border bg-background shadow-[0_24px_64px_-24px] shadow-primary/30">
                <Image
                  src={step.poster}
                  alt={step.alt}
                  width={1440}
                  height={900}
                  sizes="(min-width: 1264px) 756px, (min-width: 1024px) calc(100vw - 508px), (min-width: 640px) min(756px, calc(100vw - 4rem)), calc(100vw - 2.5rem)"
                  className="block h-auto w-full"
                />
                <DashboardVideo src={step.video} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
