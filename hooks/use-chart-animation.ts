"use client";

import { useReducedMotion } from "motion/react";

// How long a chart takes to draw. Labels that sit on the data wait this long before they fade in.
export const CHART_DRAW_MS = 800;

// Recharts draws the areas and bars on mount and when the data changes. With reduced motion the
// chart is shown in full at once.
export function useChartAnimation() {
  const reduced = useReducedMotion();

  return {
    isAnimationActive: !reduced,
    animationDuration: CHART_DRAW_MS,
    animationEasing: "ease-out",
  } as const;
}
