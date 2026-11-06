import { HOW_IT_WORKS, STEPS } from "@/components/home/content";
import Reveal from "@/components/home/reveal";
import SectionHeading from "@/components/home/section-heading";
import StepRecording from "@/components/home/step-recording";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-background py-14 sm:py-24">
      <div className="container">
        <SectionHeading heading={HOW_IT_WORKS} />

        <Reveal className="mt-7 sm:mt-12" y={32} delay={0.1}>
          <Tabs defaultValue="0" className="mx-auto w-full max-w-[1040px] gap-6 md:gap-8">
            <div className="relative">
              {/* The line sits beside the list, not inside it. It runs from the first circle's
                  centre to the last one's. Below md the steps stack: top and bottom 22 = row
                  padding 8 + half the 28 px circle, left 13 = circle centre 14 minus half the
                  2 px line. From md they sit in five equal columns and the line is horizontal,
                  from the middle of the first column to the middle of the last (10% each side).
                  Change these with the circle size or the tab padding. The tabs are relative and
                  come later, so their circles paint over the line. */}
              <span
                className="absolute top-[22px] bottom-[22px] left-[13px] w-0.5 bg-border md:hidden"
                aria-hidden="true"
              />
              <span
                className="absolute top-[21px] right-[10%] left-[10%] hidden h-0.5 bg-border md:block"
                aria-hidden="true"
              />
              <TabsList
                variant="line"
                activateOnFocus
                aria-label="How it works"
                className="w-full flex-col items-stretch justify-start gap-3.5 p-0 group-data-horizontal/tabs:h-auto md:grid md:grid-cols-5 md:gap-2"
              >
                {STEPS.map((step, index) => (
                  <TabsTrigger
                    key={step.title}
                    value={String(index)}
                    className="group/step h-auto w-full flex-none cursor-pointer items-start justify-start gap-4 rounded-sm border-0 px-0 py-2 text-left font-normal whitespace-normal after:hidden data-active:bg-transparent md:flex-col md:items-center md:gap-3 md:text-center"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-[13px] leading-4 font-medium text-muted-foreground transition-colors duration-150 group-data-active/step:border-primary group-data-active/step:bg-primary group-data-active/step:text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 pt-0.5 md:pt-0">
                      <span className="block text-base leading-6 font-medium text-foreground transition-colors duration-150 group-data-active/step:text-secondary-foreground">
                        {step.title}
                      </span>
                      <span className="mt-1 hidden text-sm leading-5 text-muted-foreground group-data-active/step:max-md:block">
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
                className="flex w-full min-w-0 flex-col gap-5 md:gap-6"
              >
                <p className="mx-auto hidden max-w-[640px] text-center text-base text-balance leading-6 text-muted-foreground md:block">
                  {step.detail}
                </p>
                <StepRecording step={step} />
              </TabsContent>
            ))}
          </Tabs>
        </Reveal>
      </div>
    </section>
  );
}
