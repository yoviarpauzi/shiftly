import type {
  BandCopy,
  ConflictExample,
  FooterCopy,
  HeroCopy,
  HomeRole,
  HomeRule,
  HomeSectionHeading,
  HomeStep,
  NavLink,
  RecordingSize,
  ScopeSite,
  StepCrop,
} from "@/types/home";

export const NAV_LINKS: NavLink[] = [
  { label: "Rules", href: "#rules" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Roles", href: "#roles" },
];

export const HERO_COPY: HeroCopy = {
  lead: "Rosters that respect",
  audience:
    "For outsourcing teams that build shift rosters for several client sites by hand.",
  subtitle:
    "Shiftly builds each location's roster from the requests you approve, and records any rule it cannot meet, with the reason.",
  claims: ["Same request, same roster.", "No AI model is involved."],
};

// The rule in the headline pill, in rotation order. Each one is a rule the roster engine
// enforces, so the rotation says something. The first is the one shown before the rotation
// starts and the one kept for reduced motion.
export const HERO_WORDS: string[] = [
  "working days",
  "shift limits",
  "position rules",
  "monthly caps",
];

export const HOW_IT_WORKS: HomeSectionHeading = {
  title: "One flow from request to attendance.",
  subtitle:
    "Every step happens in Shiftly, so the roster, its conflicts, and the attendance stay tied to the same request.",
};

// Every recording is 1440 by 900. This keeps the page area (x 300 to 1430, y 56 to 892) and drops
// the sidebar and the top bar, so the table or form fills the frame and its text stays readable.
// The toast at the bottom of each recording sits inside it.
export const STEP_CROP: StepCrop = { x: 300, y: 56, width: 1130, height: 836 };
export const RECORDING_SIZE: RecordingSize = { width: 1440, height: 900 };

// The dashboard recording in the hero window is 1440 by 780. A phone shows only the "Open
// conflicts" and "Pending approvals" cards of it, from where the first of them starts.
export const DASHBOARD_RECORDING: RecordingSize = { width: 1440, height: 780 };
export const DASHBOARD_PHONE_CROP: StepCrop = {
  x: 855,
  y: 150,
  width: 585,
  height: 210,
};

export const STEPS: HomeStep[] = [
  {
    title: "Request",
    detail:
      "A location asks for workers by department and position, with a headcount for each day. Each request gets its own PO number.",
    phoneCrop: { x: 300, y: 56, width: 560, height: 300 },
    video: "/landing/steps/request.mp4",
    poster: "/landing/steps/request.webp",
    alt: "A weekly request saved as pending, with its PO number and a confirmation that the request was created.",
  },
  {
    title: "Approve",
    detail:
      "A weekly request waits for the HO assigned to the site, the role that sees all of its locations, or a superadmin. A daily request is approved when it is saved.",
    phoneCrop: { x: 560, y: 215, width: 570, height: 260 },
    video: "/landing/steps/approve.mp4",
    poster: "/landing/steps/approve.webp",
    alt: "The requests table after a pending request is approved, with a confirmation that it was approved.",
  },
  {
    title: "Generate",
    detail:
      "Shiftly builds the roster from your work rules. The same request always gives the same roster.",
    phoneCrop: { x: 300, y: 56, width: 610, height: 185 },
    video: "/landing/steps/generate.mp4",
    poster: "/landing/steps/generate.webp",
    alt: "The draft roster: each worker's shift or day off across the week, with a confirmation that the roster was generated.",
  },
  {
    title: "Confirm",
    detail:
      "A confirmed roster is locked. Its shifts are what attendance is marked against.",
    phoneCrop: { x: 300, y: 56, width: 610, height: 185 },
    video: "/landing/steps/confirm.mp4",
    poster: "/landing/steps/confirm.webp",
    alt: "The same roster after it is confirmed: its status reads confirmed and the edit buttons are gone.",
  },
  {
    title: "Mark attendance",
    detail: "Mark each scheduled shift as present, absent, sick, or on leave.",
    phoneCrop: { x: 300, y: 56, width: 600, height: 290 },
    video: "/landing/steps/attendance.mp4",
    poster: "/landing/steps/attendance.webp",
    alt: "Attendance marked present, absent, or sick for the day's scheduled shifts, with a confirmation that it was saved.",
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
  line: "Production / Helper",
  reason:
    "Every free worker with this position is on shift 3. Moving from shift 3 to shift 1 is blocked before 7 working days in a row.",
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
      "A worker can move back to a lower shift only after a set number of working days in a row.",
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

// The example the Roles section draws: two sites, five locations in all.
export const SCOPE_SITES: ScopeSite[] = [
  { name: "Site A", locations: 3 },
  { name: "Site B", locations: 2 },
];

export const SCOPE_NOTE =
  "Filled squares are the locations a role can see, in an example with two sites and five locations.";

export const ROLES: HomeRole[] = [
  {
    name: "Superadmin",
    scope: "All sites",
    summary: "Manages sites, locations, users, and the global work rules.",
    reach: [
      [true, true, true],
      [true, true],
    ],
  },
  {
    name: "HO",
    scope: "One site, all its locations",
    summary: "Approves weekly requests and sets the work rules for the site.",
    reach: [
      [true, true, true],
      [false, false],
    ],
  },
  {
    name: "Admin site",
    scope: "One location",
    summary:
      "Makes requests, reviews rosters, and marks attendance for the location.",
    reach: [
      [false, true, false],
      [false, false],
    ],
  },
];

export const BAND_COPY: BandCopy = {
  title: "Accounts come from your superadmin.",
  detail: "No account yet? Your superadmin adds people in the Users menu.",
};

// What the band says to someone who is already signed in.
export const BAND_COPY_SIGNED_IN: BandCopy = {
  title: "Your rosters are waiting.",
  detail:
    "Requests, rosters, and attendance for your scope are in the dashboard.",
};

export const FOOTER_COPY: FooterCopy = {
  tagline: "Roster and shift management for outsourced workers across sites.",
  copyright: "© 2026 Shiftly",
};
