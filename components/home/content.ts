import type {
  BandCopy,
  ConflictExample,
  FooterCopy,
  HeroCopy,
  HeroWord,
  HomeRole,
  HomeRule,
  HomeSectionHeading,
  HomeStep,
  NavLink,
} from "@/types/home";

export const NAV_LINKS: NavLink[] = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Rules", href: "#rules" },
  { label: "Roles", href: "#roles" },
];

export const HERO_COPY: HeroCopy = {
  lead: "Rosters that",
  tail: "the rules.",
  subtitle:
    "Shiftly builds each location's roster from the requests you approve, and records any rule it cannot meet, with the reason.",
};

// The verb in the headline pill, in rotation order. The first word is the one shown
// before the rotation starts and the one kept for reduced motion. Each dot colour is a
// theme token written out in full so Tailwind can find the class.
export const HERO_WORDS: HeroWord[] = [
  { word: "follow", dotClass: "bg-chart-1" },
  { word: "respect", dotClass: "bg-chart-2" },
  { word: "honor", dotClass: "bg-chart-3" },
  { word: "meet", dotClass: "bg-chart-4" },
];

export const WORDS: string[] = [
  "Requests",
  "Rosters",
  "Attendance",
  "Work rules",
];

export const HOW_IT_WORKS: HomeSectionHeading = {
  title: "One flow from request to attendance.",
  subtitle:
    "Every step happens in Shiftly, so the roster, its conflicts, and the attendance stay tied to the same request.",
};

export const STEPS: HomeStep[] = [
  {
    title: "Request",
    detail:
      "A location asks for workers by department and position, with a headcount for each day.",
    video: "/landing/steps/request.mp4",
    poster: "/landing/steps/request.webp",
    alt: "A weekly request being filled in with its type, start date, site, location, department, position, and headcount.",
  },
  {
    title: "Approve",
    detail:
      "A weekly request waits for the HO of the site or a superadmin. A daily request is approved when it is saved.",
    video: "/landing/steps/approve.mp4",
    poster: "/landing/steps/approve.webp",
    alt: "A pending request approved from the requests table.",
  },
  {
    title: "Generate",
    detail:
      "Shiftly builds the roster from your work rules. The same request always gives the same roster.",
    video: "/landing/steps/generate.mp4",
    poster: "/landing/steps/generate.webp",
    alt: "A roster generated for an approved request, then the draft roster with each worker's shifts.",
  },
  {
    title: "Confirm",
    detail:
      "A confirmed roster is locked. Its shifts are what attendance is marked against.",
    video: "/landing/steps/confirm.mp4",
    poster: "/landing/steps/confirm.webp",
    alt: "A draft roster confirmed, after which its status changes to confirmed.",
  },
  {
    title: "Mark attendance",
    detail:
      "Mark each scheduled shift as present, absent, sick, or on leave.",
    video: "/landing/steps/attendance.mp4",
    poster: "/landing/steps/attendance.webp",
    alt: "Attendance marked for a location's scheduled shifts and saved.",
  },
];
export const RULES_HEADING: HomeSectionHeading = {
  title: "When a rule cannot be met, Shiftly says why.",
  subtitle:
    "A shift the rules cannot fill is recorded as a conflict, with its reason. Nothing is skipped quietly.",
};

export const CONFLICT_EXAMPLE: ConflictExample = {
  title: "1 conflict",
  where: "Mon 9 Nov · Shift 1 · short by 1",
  line: "Produksi / Line Pengemasan / Operator Produksi",
  reason:
    "Every free worker with this position is on shift 3. Moving from shift 3 to shift 1 is blocked before 7 working days.",
};

export const RULES: HomeRule[] = [
  {
    title: "Working days per week",
    detail: "5 or 7 days, set per site, location, or worker.",
  },
  {
    title: "Max working days per month",
    detail: "The most days a worker can be scheduled in one calendar month.",
  },
  {
    title: "Shift change",
    detail:
      "A worker can move back to a lower shift only after a set number of working days.",
  },
  {
    title: "Position match",
    detail:
      "When required, only workers with the request line's position are assigned.",
  },
];

export const ROLES_HEADING: HomeSectionHeading = {
  title: "Everyone sees their own scope.",
  subtitle:
    "Access follows the account, not the menu. Each role works inside its own slice of the data.",
};

export const ROLES: HomeRole[] = [
  {
    name: "Superadmin",
    scope: "All sites",
    summary: "Manages sites, locations, users, and the global work rules.",
  },
  {
    name: "HO",
    scope: "One site, all its locations",
    summary: "Approves weekly requests and sets the work rules for the site.",
  },
  {
    name: "Admin site",
    scope: "One location",
    summary:
      "Makes requests, reviews rosters, and marks attendance for the location.",
  },
];

export const BAND_COPY: BandCopy = {
  title: "Sign in to see this week's roster.",
  detail: "No account yet? Your superadmin adds people in the Users menu.",
};

export const FOOTER_COPY: FooterCopy = {
  tagline: "Roster and shift management for outsourced workers across sites.",
  copyright: "© 2026 Shiftly",
};
