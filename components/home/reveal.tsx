"use client";

import { MotionConfig, motion } from "motion/react";
import type { RevealProps } from "@/types/home";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// Fades and moves its children into place once, the first time they scroll into view. Under
// reduced motion the position and scale are skipped and only the fade stays. The server HTML starts
// hidden, so the element carries `data-reveal`: in print, a rule in globals.css shows it in place,
// and the page's <noscript> does the same without JavaScript.
export default function Reveal({
  children,
  className,
  delay = 0,
  x = 0,
  y = 24,
  scale = 1,
}: RevealProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        data-reveal=""
        className={className}
        initial={{ opacity: 0, x, y, scale }}
        whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.7, delay, ease: EASE_OUT }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
