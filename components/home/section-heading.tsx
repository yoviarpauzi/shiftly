import Reveal from "@/components/home/reveal";
import type { SectionHeadingProps } from "@/types/home";

// The size of a section title, shared by the sections that write their own heading block.
export const SECTION_TITLE_CLASS =
  "text-[26px] text-balance leading-8 font-bold tracking-[-0.03em] sm:text-[32px] sm:leading-10";

// A centred title and its subtitle, revealed as they scroll into view.
export default function SectionHeading({ heading }: SectionHeadingProps) {
  return (
    <Reveal className="text-center">
      <h2 className={SECTION_TITLE_CLASS}>{heading.title}</h2>
      <p className="mx-auto mt-2.5 max-w-[920px] text-base text-balance leading-6 text-muted-foreground lg:text-lg lg:leading-7">
        {heading.subtitle}
      </p>
    </Reveal>
  );
}
