import Image from "next/image";
import { TriangleAlertIcon } from "lucide-react";
import {
  CONFLICT_EXAMPLE,
  RULES,
  RULES_HEADING,
} from "@/components/home/content";
import Reveal from "@/components/home/reveal";
import { SECTION_TITLE_CLASS } from "@/components/home/section-heading";

// This section breaks the centred rhythm of the others on purpose: its subject is the one thing
// only Shiftly can show, so the conflict is the centrepiece and the words sit beside it. On a
// phone the order is heading, conflict, rules.
export default function Rules() {
  return (
    <section
      id="rules"
      className="scroll-mt-16 overflow-x-clip bg-muted pt-12 pb-14 sm:pt-[72px] sm:pb-24"
    >
      <div className="container">
        <div className="mx-auto grid max-w-[1120px] gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:items-center">
          <Reveal className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <Image
              src="/landing/doodle-work-rules.webp"
              alt=""
              aria-hidden="true"
              width={640}
              height={640}
              sizes="(min-width: 640px) 112px, 88px"
              className="block h-auto w-[88px] sm:w-[112px]"
            />
            <h2 className={`mt-4 ${SECTION_TITLE_CLASS}`}>
              {RULES_HEADING.title}
            </h2>
            <p className="mt-2.5 max-w-[520px] text-base text-balance leading-6 text-muted-foreground lg:text-lg lg:leading-7">
              {RULES_HEADING.subtitle}
            </p>
          </Reveal>

          <Reveal
            x={32}
            y={0}
            delay={0.1}
            className="w-full rounded-xl border border-destructive/40 bg-background p-6 sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1"
          >
            <p className="flex items-center gap-2.5 text-xl leading-7 font-semibold text-destructive">
              <TriangleAlertIcon className="size-5 shrink-0" aria-hidden="true" />
              {CONFLICT_EXAMPLE.title}
            </p>
            <div className="mt-4 flex flex-col gap-1 border-t border-destructive/30 pt-4">
              <p className="text-lg leading-7 font-medium text-foreground">
                {CONFLICT_EXAMPLE.where}
              </p>
              <p className="text-base leading-6 text-muted-foreground">
                {CONFLICT_EXAMPLE.line}
              </p>
              <p className="mt-3 text-lg leading-7 text-pretty text-foreground">
                {CONFLICT_EXAMPLE.reason}
              </p>
            </div>
          </Reveal>

          <ul
            role="list"
            className="grid w-full list-none grid-cols-2 gap-x-4 gap-y-5 sm:gap-x-10 sm:gap-y-7 lg:col-start-1 lg:row-start-2 lg:self-start"
          >
            {RULES.map((rule, index) => (
              <li key={rule.title}>
                <Reveal delay={0.1 + index * 0.08} y={20}>
                  <p className="text-base leading-6 font-medium text-foreground">
                    {rule.title}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-pretty text-muted-foreground">
                    {rule.detail}
                  </p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
