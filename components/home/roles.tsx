import { CheckIcon } from "lucide-react";
import {
  ROLES,
  ROLES_HEADING,
  SCOPE_LOCATIONS,
  SCOPE_NOTE,
} from "@/components/home/content";
import Reveal from "@/components/home/reveal";
import SectionHeading from "@/components/home/section-heading";
import type { ScopeCellsProps } from "@/types/home";
import { cn } from "cn";

// One square per location. A filled square with a check is a location the role can see, an empty
// one is not, so the meaning never rests on colour alone.
function ScopeCells({ reach }: ScopeCellsProps) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${SCOPE_LOCATIONS}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {reach.map((visible, index) => (
        <span
          key={index}
          className={cn(
            "flex h-10 items-center justify-center rounded-md border",
            visible
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background",
          )}
        >
          {visible ? <CheckIcon className="size-4" strokeWidth={2.5} /> : null}
        </span>
      ))}
    </div>
  );
}

const ROW_LAYOUT = "md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-x-12";

export default function Roles() {
  return (
    <section id="roles" className="scroll-mt-16 bg-muted py-14 sm:py-24">
      <div className="container">
        <SectionHeading heading={ROLES_HEADING} />

        <div className="mx-auto mt-7 max-w-[1040px] sm:mt-12">
          <p className="mb-5 text-sm leading-5 text-muted-foreground md:mb-4">
            {SCOPE_NOTE}
          </p>

          <ul role="list" className="list-none">
            {ROLES.map((role, index) => (
              <li key={role.name} className="border-t py-6 first:border-t-0 md:first:border-t md:py-7">
                <Reveal delay={index * 0.1} y={20}>
                  <div className={cn("grid gap-5 md:items-center", ROW_LAYOUT)}>
                    <div>
                      <h3 className="text-lg leading-7 font-semibold text-foreground">
                        {role.name}
                      </h3>
                      <p className="text-sm leading-5 font-medium text-secondary-foreground">
                        {role.scope}
                      </p>
                      <p className="mt-2 text-sm leading-5 text-pretty text-muted-foreground">
                        {role.summary}
                      </p>
                    </div>
                    <ScopeCells reach={role.reach} />
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>

        </div>
      </div>
    </section>
  );
}
