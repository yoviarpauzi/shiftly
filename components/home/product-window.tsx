"use client";

import { MotionConfig, motion } from "motion/react";
import Image from "next/image";
import type { ComponentProps } from "react";
import CropFrame from "@/components/home/crop-frame";
import {
  DASHBOARD_PHONE_CROP,
  DASHBOARD_RECORDING,
} from "@/components/home/content";
import DashboardVideo from "@/components/home/dashboard-video";

const MotionImage = motion.create(Image);

// Starts hidden in the server HTML, so it carries `data-reveal`: globals.css shows it in place in
// print, and the page's <noscript> does the same without JavaScript.
function RevealImage(props: ComponentProps<typeof MotionImage>) {
  return <MotionImage data-reveal="" {...props} />;
}

// The dashboard in the hero window, whole from md up.
const DASHBOARD_CROP = { x: 0, y: 0, ...DASHBOARD_RECORDING };

// The window itself stays still. Only its two doodles move: they spring in from the sides the
// first time they are on screen, and under reduced motion that is a fade. The left doodle sits
// outside the frame, in the page margin, so it never covers the sidebar of the recording. Below
// xl there is no margin for it, so it is not drawn. It sits low on the window, so it waits until
// 60% of it is on screen: with the default of one pixel it would play at load, from the bottom
// edge of the first screen, before the visitor has scrolled to it.
export default function ProductWindow() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative mx-auto w-full max-w-[960px]">
        <div className="overflow-hidden rounded-xl border bg-muted shadow-[0_24px_64px_-24px] shadow-primary/30">
          <div className="relative flex h-10 items-center border-b bg-muted px-4">
            <div className="flex gap-2" aria-hidden="true">
              <span className="size-3 rounded-full bg-border" />
              <span className="size-3 rounded-full bg-border" />
              <span className="size-3 rounded-full bg-border" />
            </div>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 text-center text-[13px] text-muted-foreground"
            >
              Shiftly
            </span>
          </div>
          {/* Below md the window shows only the "Open conflicts" and "Pending approvals" cards, at a
              size a phone can read. From md the whole dashboard is shown. */}
          <CropFrame
            size={DASHBOARD_RECORDING}
            crop={DASHBOARD_CROP}
            phoneCrop={DASHBOARD_PHONE_CROP}
            breakpoint="md"
          >
            <Image
              src="/landing/dashboard-demo.webp"
              alt="Dashboard with attendance and open conflicts"
              width={DASHBOARD_RECORDING.width}
              height={DASHBOARD_RECORDING.height}
              sizes="(min-width: 1024px) 960px, (min-width: 768px) calc(100vw - 4rem), 790px"
              priority
              className="block h-auto w-full"
            />
            <DashboardVideo src="/landing/dashboard-demo.mp4" />
          </CropFrame>
        </div>

        <RevealImage
          src="/landing/doodle-rosters.webp"
          alt=""
          width={640}
          height={640}
          sizes="(min-width: 1024px) 190px, (min-width: 768px) 150px, 104px"
          aria-hidden="true"
          initial={{ opacity: 0, x: 60, rotate: 8 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 130, damping: 16, delay: 0.5 }}
          className="pointer-events-none absolute top-[-60px] right-[-6px] w-[104px] max-w-none md:top-[-56px] md:right-[-16px] md:w-[150px] lg:top-[-68px] lg:right-[-16px] lg:w-[190px] xl:right-[-40px]"
        />
        <RevealImage
          src="/landing/doodle-attendance.webp"
          alt=""
          width={640}
          height={640}
          sizes="220px"
          aria-hidden="true"
          initial={{ opacity: 0, x: -60, rotate: -8 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ type: "spring", stiffness: 130, damping: 16, delay: 0.1 }}
          className="pointer-events-none absolute top-[300px] left-[-170px] hidden w-[220px] max-w-none xl:block 2xl:left-[-200px]"
        />
      </div>
    </MotionConfig>
  );
}
