import Image from "next/image";
import AuthButton from "@/components/home/auth-button";
import { BAND_COPY } from "@/components/home/content";

// The button sits under the copy from md and moves beside it from lg, because
// the 220 px doodle leaves too little width for both on a tablet.
export default function SignInBand() {
  return (
    <section className="bg-background pt-6 pb-12 sm:py-16 md:py-24">
      <div className="home-container">
        <div className="flex flex-col items-start gap-5 rounded-xl bg-secondary px-6 pt-8 pb-7 sm:p-10 md:flex-row md:items-center md:gap-8 lg:gap-12 lg:p-16">
          <Image
            src="/landing/doodle-requests.webp"
            alt=""
            aria-hidden
            width={640}
            height={640}
            sizes="(min-width: 768px) 220px, 140px"
            className="size-[140px] shrink-0 md:size-[220px]"
          />
          <div className="flex w-full min-w-0 flex-col items-start gap-5 md:flex-1 lg:flex-row lg:items-center lg:gap-12">
            <div className="min-w-0 lg:flex-1">
              <h2 className="text-[32px] text-balance leading-[38px] font-bold tracking-[-0.03em] md:text-[36px] md:leading-[44px] lg:text-[44px] lg:leading-[50px]">
                {BAND_COPY.title}
              </h2>
              <p className="mt-2.5 text-base leading-6 text-muted-foreground">
                {BAND_COPY.detail}
              </p>
            </div>
            <AuthButton className="h-12 w-full rounded-lg px-6 text-base sm:h-11 md:w-auto md:px-5 lg:shrink-0" />
          </div>
        </div>
      </div>
    </section>
  );
}
