import type { ReactNode } from "react";

export type NavLink = {
  label: string;
  href: string;
};

export type HomeSectionHeading = {
  title: string;
  subtitle: string;
};

export type HeroCopy = {
  lead: string;
  // Who it is for and the problem, in one line, above the subtitle.
  audience: string;
  subtitle: string;
  // What no other roster tool can honestly say, one short statement each, shown as ticks under the
  // subtitle.
  claims: string[];
};

export type DashboardVideoProps = {
  src: string;
};

export type StepRecordingProps = {
  step: HomeStep;
};

export type RotatingWordProps = {
  words: string[];
};

export type SectionHeadingProps = {
  heading: HomeSectionHeading;
};

// The size of a recording, in its own pixels.
export type RecordingSize = {
  width: number;
  height: number;
};

// The part of a recording that is kept, in recording pixels.
export type StepCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropFrameProps = {
  size: RecordingSize;
  // What shows from `breakpoint` up, and what shows below it.
  crop: StepCrop;
  phoneCrop: StepCrop;
  breakpoint: "sm" | "md";
  children: ReactNode;
};

export type HomeStep = {
  title: string;
  detail: string;
  // The part of the recording a phone shows. It is tighter than STEP_CROP and picks the part that
  // carries the result of the step, so the text is readable without sideways panning.
  phoneCrop: StepCrop;
  video: string;
  poster: string;
  alt: string;
};

export type ConflictExample = {
  title: string;
  where: string;
  line: string;
  reason: string;
};

export type HomeRule = {
  title: string;
  detail: string;
};

// One site of the example in the Roles section, with how many locations it has.
export type ScopeSite = {
  name: string;
  locations: number;
};

// `reach` has one list per site of the example, in the order of SCOPE_SITES, with one entry per
// location of that site: true for the locations the role can see.
export type HomeRole = {
  name: string;
  scope: string;
  summary: string;
  reach: boolean[][];
};

export type ScopeSitesProps = {
  className?: string;
};

export type ScopeCellsProps = {
  reach: boolean[][];
};

export type BandCopy = {
  title: string;
  detail: string;
};

export type FooterCopy = {
  tagline: string;
  copyright: string;
};

export type AuthButtonProps = {
  className?: string;
};

export type AuthLinkProps = {
  href: string;
  label: string;
  className?: string;
};

export type HeaderProps = {
  // Shown in the header from md up.
  action: ReactNode;
  // Shown at the bottom of the mobile menu.
  mobileAction: ReactNode;
};

export type RevealProps = {
  children: ReactNode;
  className?: string;
  // Seconds to wait after the element enters the view, so siblings can follow one another.
  delay?: number;
  // Where the element starts, in px, and how big it starts. It ends at 0, 0 and scale 1.
  x?: number;
  y?: number;
  scale?: number;
};
