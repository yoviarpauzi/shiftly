import Image from "next/image";
import { TriangleAlertIcon } from "lucide-react";
import {
  CONFLICT_EXAMPLE,
  RULES,
  RULES_HEADING,
} from "@/components/home/content";

export default function Rules() {
  return (
    <section
      id="rules"
      className="scroll-mt-16 bg-background pt-12 pb-14 sm:pt-[72px] sm:pb-24"
    >
      <div className="home-container">
        <Image
          src="/landing/doodle-work-rules.webp"
          alt=""
          aria-hidden="true"
          width={640}
          height={640}
          sizes="(min-width: 640px) 200px, 120px"
          className="mx-auto block h-auto w-[120px] sm:w-[200px]"
        />

        <div className="mt-6 text-center sm:mt-8">
          <h2 className="text-[34px] text-balance leading-10 font-bold tracking-[-0.03em] sm:text-[44px] sm:leading-[52px] lg:text-[56px] lg:leading-[62px]">
            {RULES_HEADING.title}
          </h2>
          <p className="mx-auto mt-2.5 max-w-[920px] text-base text-balance leading-6 text-muted-foreground lg:text-lg lg:leading-7">
            {RULES_HEADING.subtitle}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-7 sm:mt-8 sm:gap-10 lg:flex-row lg:items-start lg:gap-20">
          <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-5 sm:p-6 lg:w-[480px] lg:shrink-0">
            <p className="flex items-center gap-2 text-base leading-6 font-medium text-destructive">
              <TriangleAlertIcon className="size-[18px]" aria-hidden="true" />
              {CONFLICT_EXAMPLE.title}
            </p>
            <div className="mt-3 flex flex-col gap-0.5 border-t border-destructive/30 pt-3">
              <p className="text-sm leading-5 font-medium text-foreground">
                {CONFLICT_EXAMPLE.where}
              </p>
              <p className="text-sm leading-5 text-muted-foreground">
                {CONFLICT_EXAMPLE.line}
              </p>
              <p className="text-sm leading-5 text-foreground">
                {CONFLICT_EXAMPLE.reason}
              </p>
            </div>
          </div>

          <ul
            role="list"
            className="grid w-full list-none grid-cols-2 gap-x-4 gap-y-5 sm:gap-x-12 sm:gap-y-8 lg:flex-1"
          >
            {RULES.map((rule) => (
              <li key={rule.title}>
                <p className="text-base leading-6 font-medium text-foreground">
                  {rule.title}
                </p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {rule.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
