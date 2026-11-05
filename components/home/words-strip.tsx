import { WORDS } from "@/components/home/content";

export default function WordsStrip() {
  return (
    <section className="pt-8 pb-12 md:pt-10 md:pb-16 lg:pt-16 lg:pb-24">
      <div className="home-container">
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-muted-foreground/80 md:flex-nowrap md:justify-between md:text-[32px] md:leading-10 lg:text-[40px] lg:leading-[48px]">
          {WORDS.map((word) => (
            <li key={word} className="text-center whitespace-nowrap">
              {word}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
