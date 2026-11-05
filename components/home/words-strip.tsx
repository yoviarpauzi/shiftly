import { WORDS } from "@/components/home/content";

export default function WordsStrip() {
  return (
    <section className="py-8 md:py-16 lg:py-24">
      <div className="home-container">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-6 text-[28px] leading-9 font-semibold text-muted-foreground md:flex md:justify-between md:text-[32px] md:leading-10 lg:text-[40px] lg:leading-[48px]">
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
