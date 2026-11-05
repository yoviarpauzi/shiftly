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
  highlight: string;
  tail: string;
  subtitle: string;
};

export type HomeStep = {
  title: string;
  detail: string | null;
  active: boolean;
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
