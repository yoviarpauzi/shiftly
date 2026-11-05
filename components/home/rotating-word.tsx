"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { RotatingWordProps } from "@/types/home";
import { cn } from "cn";

const ROTATE_EVERY_MS = 2500;

// The pill is as wide as the longest word, so the line never shifts when the word changes.
// Screen readers get the first word as plain text; the rotation is for the eye only.
export default function RotatingWord({ words }: RotatingWordProps) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || words.length < 2) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % words.length);
    }, ROTATE_EVERY_MS);
    return () => clearInterval(timer);
  }, [reduceMotion, words.length]);

  const active = words[reduceMotion ? 0 : index];
  if (!active) return null;

  return (
    <span className="inline-flex items-center gap-[0.18em] rounded-full bg-secondary px-[0.27em] py-[0.04em]">
      <span
        className={cn(
          "size-[0.5em] shrink-0 rounded-full transition-colors duration-300 ease-out",
          active.dotClass,
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{words[0]?.word}</span>
      <span className="relative grid text-center text-foreground" aria-hidden="true">
        {words.map((entry) => (
          <span key={entry.word} className="invisible col-start-1 row-start-1">
            {entry.word}
          </span>
        ))}
        <AnimatePresence initial={false}>
          <motion.span
            key={active.word}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {active.word}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
