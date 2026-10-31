# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

The package manager is Bun (`packageManager: bun@1.4.2`, `bun.lock`). Use `bun` and `bunx`, not npm.

- `bun install`
- `bun run dev`: Next.js dev server on http://localhost:3000
- `bun run build` and `bun run start`
- `bun run lint`: ESLint 9 with the Next.js Core Web Vitals and TypeScript rules (`eslint.config.mjs`)
- `bunx tsc --noEmit`: type check with `strict: true`. There is no package script for it.
- `bun run test`: Vitest, `node` environment, includes `**/*.test.ts` (`vitest.config.mts`)
- `bun run test:watch`: Vitest in watch mode
- Single test file: `bun run test path/to/file.test.ts`. Single test by name: `bun run test -t "name"`. Both are standard Vitest filters.

Current state:
- There are no test files yet, so `bun run test` exits with code 1 and "No test files found".
- `bun run lint` fails on existing code: `setState` inside effects in `components/dashboard/chart-area-interactive.tsx:149` and `hooks/use-mobile.ts:14`.
- `bunx tsc --noEmit` fails on `app/dashboard/users/page.tsx`, which is an empty file.

These failures predate the test setup. Check them before using lint or type check as a gate.

### Database

- Copy `.env.example` to `.env`. Never commit `.env`.
- Required variables: `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `DB_HOST`, `DB_URL`, and `BETTER_AUTH_SECRET`.
- `lib/auth.ts` reads `DB_URL` directly, so keep it in sync with the other `DB_*` values.
- `docker compose up -d` starts `shiftly-postgres` (PostgreSQL 18.3). `compose.prod.yaml` is the production service.
- `drizzle.config.ts` loads `.env` with `process.loadEnvFile`, so the file must exist before any drizzle-kit command.
- Use `bunx drizzle-kit generate` then `bunx drizzle-kit migrate` for shared databases. `push` changes the database without creating migration files.

## Architecture

**App shell.** Next.js 16.4.3 App Router, React 19.3, Turbopack. `next.config.ts` enables `cacheComponents`. This Next.js version has breaking changes, so read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (see `AGENTS.md`). In Next.js 16, `middleware.ts` is now `proxy.ts`.

**Routes.**
- `/` is the landing page (`app/page.tsx`).
- `/sign-in` is a stub that renders `null`.
- `/dashboard/*` is the admin shell. `app/dashboard/layout.tsx` wraps `SidebarProvider`, `AppSidebar`, and `Header`. Its pages show template data from `app/dashboard/data.json`.
- `/api/auth/[...all]` is the better-auth handler.

**Auth.** `lib/auth.ts` creates the better-auth instance. It uses the Drizzle adapter over a `pg` pool created from `DB_URL`, with email and password enabled. `baseURL` is hardcoded to `http://localhost:3000/`. `lib/auth-client.ts` exists but no page uses it.

No server-side session check exists yet. `/dashboard` is reachable without logging in, so do not assume it is protected. The planned approach is in `docs/SECURITY.md`.

**Data.** `database/schema/*.ts` is the source of truth. `drizzle.config.ts` reads every file in that folder. Only the four auth tables are modeled. Roster tables are planned and listed in `docs/DATABASE.md` under "Not yet implemented".

**Roster domain (planned, not built).** The product generates shift rosters for outsourced workers across sites, using a rule engine. The engine must be deterministic: the same input gives the same roster, and no AI model is used. A rule that cannot be met must be recorded as a conflict with its reason, never skipped. The rules and open questions are in `docs/PRD.md`. The test strategy is in `docs/TESTING.md`.

Domain terms: PKDW (employee type), roster, shift, site, department, sub-department, off, break. The PRD renamed "Work Area" to "Department" everywhere, including UI and data. Use "department".

**UI.** Components follow shadcn/ui (`components.json`: style `base-nova`, icons from lucide) on top of Base UI (`@base-ui/react`). The primitives in `components/ui/` are generated, so change variants there rather than styling each page.

Theme tokens are CSS variables in `app/globals.css` under `:root`, mapped into Tailwind v4 through `@theme inline`. The app is light mode only. Use tokens rather than hex values in components (`docs/DESIGN.md`).

Components import `cn` from the `cn` npm package. `lib/utils.ts` re-exports it, and one file imports from `@/lib/utils`. Both work.

**Docs.** `docs/PRD.md` holds the product rules and open questions. `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/TESTING.md`, `docs/SECURITY.md`, and `docs/DESIGN.md` cover their own areas. `docs/CODE_STYLE.md` and `docs/DESIGN_SYSTEM.md` are empty. `README.md` is the `create-next-app` boilerplate and is not project documentation.
