import type { CSSProperties } from "react";
import type { CropFrameProps, RecordingSize, StepCrop } from "@/types/home";

// A crop, as the CSS values that show it. The recording is drawn this much wider than the frame
// and pulled left and up, so only the kept part is visible. The percentages for left and top are
// of the frame's own width and height, which is why both come from the crop's size.
function cropVars(crop: StepCrop, size: RecordingSize, suffix: string): CSSProperties {
  return {
    [`--ar${suffix}`]: `${crop.width} / ${crop.height}`,
    [`--w${suffix}`]: `${(size.width / crop.width) * 100}%`,
    [`--l${suffix}`]: `${(-crop.x / crop.width) * 100}%`,
    [`--t${suffix}`]: `${(-crop.y / crop.height) * 100}%`,
  } as CSSProperties;
}

// Tailwind reads class names from the source, so each breakpoint spells its classes out.
const FROM_BREAKPOINT = {
  sm: { frame: "sm:aspect-(--ar)", box: "sm:top-(--t) sm:left-(--l) sm:w-(--w)" },
  md: { frame: "md:aspect-(--ar)", box: "md:top-(--t) md:left-(--l) md:w-(--w)" },
} as const;

// Shows part of a recording: a frame that clips, and inside it a box the size of the whole
// recording, pulled so that only the crop shows. Children (the poster and the video) fill that
// box. A phone gets `phoneCrop` and the width from `breakpoint` up gets `crop`. The frame is also
// what DashboardVideo watches to know whether the recording is on screen, because a crop shows
// only part of the video's own box.
export default function CropFrame({
  size,
  crop,
  phoneCrop,
  breakpoint,
  children,
}: CropFrameProps) {
  const at = FROM_BREAKPOINT[breakpoint];

  return (
    <div
      data-video-frame=""
      className={`relative aspect-(--ar-phone) overflow-hidden ${at.frame}`}
      style={{ ...cropVars(phoneCrop, size, "-phone"), ...cropVars(crop, size, "") }}
    >
      <div
        className={`absolute top-(--t-phone) left-(--l-phone) w-(--w-phone) ${at.box}`}
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
      >
        {children}
      </div>
    </div>
  );
}
