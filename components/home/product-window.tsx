"use client";

import {
  MotionConfig,
  motion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import Image from "next/image";
import { useRef } from "react";
import DashboardVideo from "@/components/home/dashboard-video";

const MotionImage = motion.create(Image);

// The window starts tilted back and a little small, then settles flat as it scrolls up the
// page. The first frame is already partly settled on a normal screen, so the poster is never
// hidden. Reduced motion drops the transform with CSS, so the server and client markup match.
export default function ProductWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start 0.4"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });
  const rotateX = useTransform(progress, [0, 1], [14, 0]);
  const scale = useTransform(progress, [0, 1], [0.9, 1]);
  const y = useTransform(progress, [0, 1], [48, 0]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={ref}
        className="relative mx-auto w-full max-w-[960px] [perspective:1200px]"
      >
        <motion.div
          style={{ rotateX, scale, y, transformOrigin: "50% 0%" }}
          className="overflow-hidden rounded-xl border bg-muted shadow-[0_24px_64px_-24px] shadow-primary/30 motion-reduce:transform-none!"
        >
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
          <div className="h-60 overflow-hidden md:h-auto">
            <div className="relative w-[480px] max-w-none min-w-full md:w-full">
              <Image
                src="/landing/dashboard-demo.webp"
                alt="Dashboard with attendance and open conflicts"
                width={1440}
                height={780}
                sizes="(min-width: 1024px) 960px, (min-width: 640px) calc(100vw - 4rem), max(480px, calc(100vw - 2.5rem))"
                priority
                className="block h-auto w-full"
              />
              <DashboardVideo src="/landing/dashboard-demo.mp4" />
            </div>
          </div>
        </motion.div>

        <MotionImage
          src="/landing/doodle-rosters.webp"
          alt=""
          width={640}
          height={640}
          sizes="(min-width: 1024px) 240px, (min-width: 768px) 180px, 120px"
          aria-hidden="true"
          initial={{ opacity: 0, x: 60, rotate: 8 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 130, damping: 16, delay: 0.5 }}
          className="pointer-events-none absolute top-[-46px] right-[-10px] w-[120px] max-w-none md:top-[-64px] md:right-[-16px] md:w-[180px] lg:top-[-80px] lg:right-[-16px] lg:w-[240px] xl:right-[-40px]"
        />
        <MotionImage
          src="/landing/doodle-attendance.webp"
          alt=""
          width={640}
          height={640}
          sizes="(min-width: 1024px) 260px, (min-width: 768px) 200px, 130px"
          aria-hidden="true"
          initial={{ opacity: 0, x: -60, rotate: -8 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 130, damping: 16, delay: 0.65 }}
          className="pointer-events-none absolute top-[174px] left-0 w-[130px] max-w-none md:top-[230px] md:left-[-24px] md:w-[200px] lg:top-[310px] lg:left-[-24px] lg:w-[260px] xl:left-[-90px]"
        />
      </div>
    </MotionConfig>
  );
}
