"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { RotatingWordProps } from "@/types/home";

// Four seconds is enough to read a phrase. The rotation loops, except for visitors who ask for
// reduced motion, who see the first phrase only.
const ROTATE_EVERY_MS = 4000;

// The pill is as wide as the longest phrase, so the line never shifts when the phrase changes. The
// phrase sits in the middle and a shorter one leaves its spare room on both sides. The rotation is for
// the eye only: the headline names every rule in a sentence for screen readers (see hero.tsx).
export default function RotatingWord({ words }: RotatingWordProps) {
  // Counts the changes made. The phrase shown is step modulo the number of phrases.
  const [step, setStep] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || words.length < 2) return;
    const timer = setTimeout(() => setStep((current) => current + 1), ROTATE_EVERY_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion, words.length, step]);

  const active = words[reduceMotion ? 0 : step % words.length];
  if (!active) return null;

  return (
    <span
      className="inline-flex max-w-full items-center rounded-full bg-secondary px-[0.3em] py-[0.04em]"
      aria-hidden="true"
    >
      <span className="relative grid text-center text-foreground">
        {words.map((word) => (
          <span key={word} className="invisible col-start-1 row-start-1 whitespace-nowrap">
            {word}
          </span>
        ))}
        <AnimatePresence initial={false}>
          <motion.span
            key={active}
            className="absolute inset-0 whitespace-nowrap"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {active}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
