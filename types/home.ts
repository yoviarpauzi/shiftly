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
  tail: string;
  subtitle: string;
};

export type HeroWord = {
  word: string;
  dotClass: string;
};

export type DashboardVideoProps = {
  src: string;
};

export type RotatingWordProps = {
  words: HeroWord[];
};

export type HomeStep = {
  title: string;
  detail: string;
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

// Listed outermost first: each role's box sits inside the previous one.
export type HomeRole = {
  name: string;
  scope: string;
  summary: string;
};

export type RoleBoxProps = {
  roles: HomeRole[];
  depth: number;
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
