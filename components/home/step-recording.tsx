"use client";

import Image from "next/image";
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
// the whole page area.
export default function StepRecording({ step }: StepRecordingProps) {
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
        <DashboardVideo src={step.video} />
      </CropFrame>
    </div>
  );
}
