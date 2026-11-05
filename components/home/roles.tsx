import { ROLES, ROLES_HEADING } from "@/components/home/content";
import Reveal from "@/components/home/reveal";
import type { RoleBoxProps } from "@/types/home";
import { cn } from "cn";

// Box colours, outermost first. A role past the list reuses it from the start.
const BOX_STYLES = [
  "rounded-xl bg-background p-5 sm:p-8",
  "rounded-lg bg-muted p-4 sm:p-8",
  "rounded-lg border-primary/25 bg-secondary p-4 sm:p-8",
];

// Each role's box holds the next role, so a longer ROLES nests deeper.
function RoleBox({ roles, depth }: RoleBoxProps) {
  const [role, ...inner] = roles;
  if (!role) return null;

  return (
    <Reveal
      className={cn("border", BOX_STYLES[depth % BOX_STYLES.length])}
      delay={depth * 0.18}
      y={20}
      scale={0.98}
    >
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:gap-8">
        <div className="shrink-0">
          <h3 className="text-lg leading-7 font-semibold text-foreground">
            {role.name}
          </h3>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            {role.scope}
          </p>
        </div>
        <p className="min-w-0 text-sm leading-5 text-muted-foreground md:max-w-[480px] md:flex-1">
          {role.summary}
        </p>
      </div>
      {inner.length > 0 ? (
        <div className="mt-4 sm:mt-6">
          <RoleBox roles={inner} depth={depth + 1} />
        </div>
      ) : null}
    </Reveal>
  );
}

export default function Roles() {
  return (
    <section id="roles" className="scroll-mt-16 bg-muted py-14 sm:py-24">
      <div className="container">
        <Reveal className="text-center">
          <h2 className="text-[34px] text-balance leading-10 font-bold tracking-[-0.03em] sm:text-[44px] sm:leading-[52px] lg:text-[56px] lg:leading-[62px]">
            {ROLES_HEADING.title}
          </h2>
          <p className="mx-auto mt-2.5 max-w-[920px] text-base text-balance leading-6 text-muted-foreground lg:text-lg lg:leading-7">
            {ROLES_HEADING.subtitle}
          </p>
        </Reveal>

        <div className="mt-7 sm:mt-12">
          <RoleBox roles={ROLES} depth={0} />
        </div>
      </div>
    </section>
  );
}
