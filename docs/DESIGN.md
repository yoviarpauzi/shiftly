---
name: Shiftly
description: Design system for Shiftly, a roster and shift management app for outsourced workers across multiple sites.
colors:
  brand: "#303CCC"
  brand-hover: "#243CC0"
  brand-deep: "#1B2A8F"
  brand-tint: "#EEF0FC"
  accent: "#18B4A8"
  accent-text: "#0B6B64"
  accent-tint: "#E6F7F5"
  ink: "#14161F"
  ink-muted: "#5B6070"
  surface: "#FFFFFF"
  surface-muted: "#F5F6FA"
  border: "#D9DCE6"
  border-strong: "#7C8296"
  danger: "#C62828"
typography:
  display:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.03em
  heading:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.02em
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: 400
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  3xl: 120px
---

# DESIGN.md — Shiftly

This document is the visual and interaction reference for Shiftly. Colors come from the logo (`public/logo.webp`): indigo blue for primary actions and teal as the accent. The layout follows the Notion landing page reference: large, confident headings, generous whitespace, lightweight cards with thin borders, and product screenshots in softly shadowed frames.

## 1. Identity

- **Product:** roster and shift tracking for outsourced workers across multiple sites.
- **Tone:** calm, tidy, and trustworthy. The main users are HR admins and supervisors working with dense data, so the interface must be clear, not busy.
- **UI language:** Bahasa Indonesia. Field terms that are already standard on the ground (roster, shift, site, department, off) stay as they are.

## 2. Logo

- The logo is two circular arrows (blue on top, teal below) framing a 3×3 grid of squares. It represents shift rotation and scheduling.
- Use `public/logo.webp` as is. Do not change its colors, rotation, or proportions.
- Keep clear space around the logo at least the height of one grid square.
- On dark backgrounds, place the logo inside a white card so the blue and teal stay readable.
- Minimum size: 24 px for the favicon and navigation, 32 px for the header.

## 3. Color

Primary colors come from the logo. Neutrals are slightly cool so they sit well next to the blue.

| Token | Hex | Usage |
| --- | --- | --- |
| `brand` | `#303CCC` | Primary buttons, links, focus, active state |
| `brand-hover` | `#243CC0` | Hover and pressed state for primary buttons |
| `brand-deep` | `#1B2A8F` | Emphasized headings, text on `brand-tint` |
| `brand-tint` | `#EEF0FC` | Badge backgrounds, selected rows, light highlights |
| `accent` | `#18B4A8` | Decoration, icons, chart bars, "scheduled" indicator |
| `accent-text` | `#0B6B64` | Small teal text and icons (sufficient contrast) |
| `accent-tint` | `#E6F7F5` | Success status backgrounds and teal badges |
| `ink` | `#14161F` | Primary text and headings |
| `ink-muted` | `#5B6070` | Secondary text, captions, placeholders |
| `surface` | `#FFFFFF` | Page and card backgrounds |
| `surface-muted` | `#F5F6FA` | Section backgrounds, side panels, table areas |
| `border` | `#D9DCE6` | Dividers and card borders |
| `border-strong` | `#7C8296` | Input borders and controls that must stay clearly visible |
| `danger` | `#C62828` | Roster rule violations, errors, delete actions |

**Usage rules**

- `brand` blue is the only color for primary buttons. Show at most one primary button per screen.
- Do not use the teal `accent` for small text on white. Use `accent-text` for text and `accent` for fills or icons.
- Text on `accent` must be `ink`, not white.
- Do not use blue and teal alone to distinguish meaningful status. Add an icon or label, since users may not tell the two apart.
- `danger` is only for rule violations (work pattern, shift change, break, off allowance) and errors. Never use it as decoration.

**Contrast (WCAG AA)**

- `ink` on `surface`: 18.0:1
- `ink-muted` on `surface`: 6.3:1
- `surface` on `brand`: 7.9:1
- `brand` on `brand-tint`: 7.0:1
- `brand-deep` on `brand-tint`: 10.4:1
- `accent-text` on `accent-tint`: 5.8:1
- `border-strong` on `surface`: 3.8:1 (enough for input borders, minimum 3:1)

## 4. Typography

- **Primary font:** Inter (already loaded in `app/layout.tsx` as `--font-sans`).
- **Numbers and code:** Geist Mono for shift codes, technical dates, and numeric tables. Numbers in tables use `tabular-nums`.
- **Headings** use weight 700 with negative letter-spacing, as in the reference. Do not set headings in all caps.
- **Body** is 16 px with a 1.6 line-height. Keep line length to about 70 characters at most.
- **Caption** is 13 px in `ink-muted`, for image captions, metadata, and small labels.
- Desktop type scale: display 64 px, heading 32 px, body 16 px, caption 13 px. On small screens, display drops to 40 px and heading to 26 px.

## 5. Layout and spacing

- Use multiples of 8 px for main spacing. The `spacing` tokens above are the source of truth.
- Maximum content width is 1200 px. On mobile, use 16 px side gutters.
- Separate sections with `spacing.2xl` to `spacing.3xl`, as on the reference landing page, so each section feels spacious.
- Hero sections and page headers are centered. Data tables and forms are left-aligned.
- Dashboard pages use a two-column layout on desktop: a filter or navigation panel on the left (240 px wide) and main content on the right. On mobile, the panel stacks above the content.
- No horizontal scrolling at the page level. Roster tables may scroll horizontally inside their own container.

## 6. Shape, shadow, and border

- Buttons and inputs: `md` (8 px). Cards: `lg` (12 px). Modals and screenshot frames: `xl` (16 px). Badges and chips: `pill`.
- Cards use a 1 px `border` and a `surface` background. Shadows are only for floating elements (dropdowns, modals, screenshot frames), with a soft blur and low opacity.
- Screenshot frames and roster previews use a `border` and a soft shadow, like the product cards in the reference.

## 7. Components

**Buttons**
- Primary: `brand` background, `surface` text, 40 px height, `md` radius. Hover: `brand-hover`.
- Secondary: `brand-tint` background, `brand-deep` text. Slightly darker on hover.
- Ghost: `ink` text, no background. Hover: `surface-muted`.
- Destructive: `danger` background, used only for deleting or cancelling a roster that has already been sent.
- Pill buttons (`pill`) are only for landing-page CTAs, such as "Mulai gratis" or "Minta demo" (UI copy is in Bahasa Indonesia).

**Inputs and forms**
- `border-strong` border, `md` radius, 40 px height. Focus: a 2 px `brand` ring with a 2 px offset.
- Labels sit above the input in `ink`. Help and error text sit below the input in `caption`. Errors use `danger` plus an icon.

**Roster status badges**
- Passed: `accent-tint` background, `accent-text` text, check icon.
- Needs review: `brand-tint` background, `brand-deep` text.
- Rule violation: light `danger` background, `danger` text, warning icon. Never rely on color alone.

**Roster table**
- Header uses `surface-muted` with bold `caption` text. Rows are separated by `border`. Selected rows use `brand-tint`.
- Date and shift code cells use Geist Mono.
- The first column (employee name) stays visible when the table scrolls horizontally.

**Feature cards**
- `surface` background, `border` border, `lg` radius, 24 px padding. Icon at the top left inside a `brand-tint` or `accent-tint` square.
- Card titles use a small `heading` (20 px, weight 600). Descriptions use `ink-muted`.

**Navigation**
- White header with a `border` bottom border, 64 px tall. Logo on the left, menu in the center or left, actions on the right.
- On dashboard pages, the active nav item uses `brand-tint` with `brand-deep` text.

## 8. Icons and illustration

- Use Lucide (`lucide-react`) with 1.75 stroke and 16–20 px size. Icons take the color of the surrounding text.
- Illustrations are built from grid squares, arrows, and small square patterns that echo the logo. Avoid cartoon character illustrations like the reference, since this product handles sensitive employee data.
- If people photos are used (for example, testimonials), place them on a `surface-muted` or `brand-tint` background with a colored block behind them.

## 9. Motion and interaction

- Hover and focus transitions take 150 ms, `ease-out`.
- Panels and dropdowns appear with a fade and a 4 px slide, finishing within 200 ms.
- Respect `prefers-reduced-motion`: remove the slide and keep the fade.
- Actions that change a roster must give immediate feedback: the button switches to a loading state, then the status badge updates.

## 10. Responsive

- Breakpoints: 640 px (mobile to tablet) and 1024 px (tablet to desktop).
- On mobile, navigation collapses into a hidden menu. Primary buttons span the full width. Roster tables stay horizontally scrollable inside their container.
- Minimum tap target is 44 × 44 px on touch screens.

## 11. Accessibility

- Minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text and UI elements.
- Every interactive element has a visible focus ring (`brand`, 2 px).
- Do not distinguish status with color alone. Always include an icon or label.
- Every icon without text must have an `aria-label`.

## 12. Implementation notes

- The color and radius tokens above are mapped to the shadcn variables in `app/globals.css` (`:root`). The app is light mode only.
- `--radius` is `0.75rem` (12 px), so `rounded-lg` matches `lg`. `rounded-md` and `rounded-sm` are pinned to 8 px and 6 px in the `@theme` block.
- Fonts: Inter as `--font-sans`, Geist Mono as `--font-geist-mono`.
- Base components use shadcn/ui (`components/ui`). Change variants there instead of overriding styles on each page.
- Do not write hex colors directly in components. Use tokens or CSS variables.

## 13. Out of scope

- Dark mode.
- Cartoon character illustrations, large decorative animations, and gradients beyond the blue–teal from the logo.
- Red or yellow as brand colors. Both are reserved for status.
