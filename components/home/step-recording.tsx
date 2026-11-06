"use client";

import { useReducedMotion } from "motion/react";
import { PauseIcon, PlayIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import CropFrame from "@/components/home/crop-frame";
import DashboardVideo from "@/components/home/dashboard-video";
import { RECORDING_SIZE, STEP_CROP } from "@/components/home/content";
import type { StepCrop, StepRecordingProps } from "@/types/home";

// The poster is drawn this many times as wide as its frame, so the browser needs a source that
// wide. 1040 is the frame's maximum width, the max-w-[1040px] of the steps in how-it-works.tsx.
const DESKTOP_SCALE = RECORDING_SIZE.width / STEP_CROP.width;
const DESKTOP_SIZES = `(min-width: 1100px) ${Math.round(DESKTOP_SCALE * 1040)}px, (min-width: 640px) ${Math.round(DESKTOP_SCALE * 100)}vw`;

function posterSizes(phoneCrop: StepCrop): string {
  return `${DESKTOP_SIZES}, ${Math.round((RECORDING_SIZE.width / phoneCrop.width) * 100)}vw`;
}

// A step's recording in its frame. The poster is the finished state, so a visitor who never plays
// the recording still sees the result of the step. A phone shows a tighter crop that holds the
// result of the step, so its text is readable without panning sideways; from sm the frame shows
// the whole page area. Once the recording is playing the visitor can pause it.
export default function StepRecording({ step }: StepRecordingProps) {
  const reduceMotion = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-xl border bg-background shadow-[0_24px_64px_-24px] shadow-primary/30">
      <CropFrame
        size={RECORDING_SIZE}
        crop={STEP_CROP}
        phoneCrop={step.phoneCrop}
        breakpoint="sm"
      >
        <Image
          src={step.poster}
          alt={step.alt}
          width={RECORDING_SIZE.width}
          height={RECORDING_SIZE.height}
          sizes={posterSizes(step.phoneCrop)}
          className="block h-auto w-full"
        />
        <DashboardVideo
          src={step.video}
          paused={paused}
          onStart={() => setStarted(true)}
        />
      </CropFrame>

      {started && !reduceMotion ? (
        <button
          type="button"
          onClick={() => setPaused((current) => !current)}
          aria-label={paused ? "Play recording" : "Pause recording"}
          className="absolute right-3 bottom-3 flex size-11 cursor-pointer items-center justify-center rounded-full border bg-background/90 text-foreground shadow-sm transition-colors duration-150 outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          {paused ? <PlayIcon className="size-4" /> : <PauseIcon className="size-4" />}
        </button>
      ) : null}
    </div>
  );
}
