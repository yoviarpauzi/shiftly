import { CheckIcon } from "lucide-react";
import {
  ROLES,
  ROLES_HEADING,
  SCOPE_NOTE,
  SCOPE_SITES,
} from "@/components/home/content";
import Reveal from "@/components/home/reveal";
import SectionHeading from "@/components/home/section-heading";
import type { ScopeCellsProps, ScopeSitesProps } from "@/types/home";
import { cn } from "cn";

// The sites keep their share of the width: a site with three locations is three fifths of the
// row, so every location is the same width whatever site it is in.
const SITE_COLUMNS = SCOPE_SITES.map((site) => `${site.locations}fr`).join(" ");

// Site names over the squares. The names are decoration for the diagram: the role's scope is
// also written out in words next to it.
function ScopeSites({ className }: ScopeSitesProps) {
  return (
    <div
      className={cn("grid gap-4 text-sm leading-5 text-muted-foreground", className)}
      style={{ gridTemplateColumns: SITE_COLUMNS }}
      aria-hidden="true"
    >
      {SCOPE_SITES.map((site) => (
        <span key={site.name} className="border-b pb-1.5">
          {site.name}
        </span>
      ))}
    </div>
  );
}

// One square per location. A filled square with a check is a location the role can see, an empty
// one is not, so the meaning never rests on colour alone.
function ScopeCells({ reach }: ScopeCellsProps) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: SITE_COLUMNS }}
      aria-hidden="true"
    >
      {SCOPE_SITES.map((site, siteIndex) => {
        return (
          <div
            key={site.name}
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${site.locations}, minmax(0, 1fr))` }}
          >
            {(reach[siteIndex] ?? []).map((visible, index) => (
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
      })}
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

          <div className={cn("hidden md:grid", ROW_LAYOUT)}>
            <span />
            <ScopeSites />
          </div>

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
                    <div className="flex flex-col gap-2">
                      <ScopeSites className="md:hidden" />
                      <ScopeCells reach={role.reach} />
                    </div>
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
