import Image from "next/image";
import { Suspense } from "react";
import AuthButton from "@/components/home/auth-button";
import { BAND_COPY, BAND_COPY_SIGNED_IN } from "@/components/home/content";
import Reveal from "@/components/home/reveal";
import { isSignedIn } from "@/components/home/session";
import type { BandCopy } from "@/types/home";

function BandText({ copy }: { copy: BandCopy }) {
  return (
    <>
      <h2 className="text-[26px] text-balance leading-8 font-bold tracking-[-0.03em] md:text-[32px] md:leading-10">
        {copy.title}
      </h2>
      <p className="mt-2.5 text-base leading-6 text-muted-foreground">
        {copy.detail}
      </p>
    </>
  );
}

// The band's words depend on the visitor, so they wait for the session like the button does. The
// fallback is what a signed-out visitor reads.
async function SessionBandText() {
  return <BandText copy={(await isSignedIn()) ? BAND_COPY_SIGNED_IN : BAND_COPY} />;
}

export default function SignInBand() {
  return (
    <section className="bg-background pt-6 pb-12 sm:py-16 md:py-24">
      <div className="container">
        <Reveal
          y={32}
          scale={0.97}
          className="flex flex-col items-start gap-5 rounded-xl bg-secondary px-6 pt-8 pb-7 sm:p-10 md:flex-row md:items-center md:gap-8 lg:gap-12 lg:p-16"
        >
          <Reveal className="shrink-0" scale={0.8} y={12} delay={0.25}>
            <Image
              src="/landing/doodle-requests.webp"
              alt=""
              aria-hidden
              width={640}
              height={640}
              sizes="(min-width: 768px) 220px, 140px"
              className="size-[140px] md:size-[220px]"
            />
          </Reveal>
          <div className="min-w-0 md:flex-1">
            <Suspense fallback={<BandText copy={BAND_COPY} />}>
              <SessionBandText />
            </Suspense>
            <AuthButton className="mt-5 h-11 w-full rounded-lg px-6 focus-visible:ring-offset-secondary sm:w-auto" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
