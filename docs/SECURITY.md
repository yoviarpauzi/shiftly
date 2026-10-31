# Security

This document describes the security state of Shiftly: what is in place today, what the PRD requires, and what is still to be done. It is a working checklist for the team, not a formal security policy. The architecture is described in [ARCHITECTURE.md](ARCHITECTURE.md), and the product requirements are in the [PRD](PRD.md).

Shiftly stores employee data, which is personal data under the Indonesian personal data protection law (UU PDP). The PRD requires that access be limited by role and site, that roster history be kept for audit, and that the processing of employee data be reviewed against UU PDP. Treat every item in this document as part of that requirement.

## Current state

| Area | State | Evidence |
| --- | --- | --- |
| Login | Email and password only, through better-auth | `lib/auth.ts` (`emailAndPassword: { enabled: true }`) |
| Email verification | Not configured | `lib/auth.ts` does not set it |
| Server-side session check | None. Anyone who opens `/dashboard` can see it | `app/dashboard/layout.tsx`, no `proxy.ts` or `middleware.ts` |
| Authorization (roles) | None. No roles or site scoping exist yet | Not implemented |
| Secrets | `BETTER_AUTH_SECRET` is read from the environment by better-auth. `lib/auth.ts` does not set it | `.env.example`, `lib/auth.ts` |
| Secret files | `.env*` and `*.pem` are ignored by git | `.gitignore` |
| Database port, development | Exposed on all network interfaces | `compose.yaml` (`"${DB_PORT}:5432"`) |
| Database port, production | Bound to `127.0.0.1` only | `compose.prod.yaml` |
| Security headers and CSP | Not configured | `next.config.ts` has no `headers()` |
| Raw HTML rendering | `dangerouslySetInnerHTML` is used once, in the shadcn chart component to inject theme CSS | `components/ui/chart.tsx` |
| Employee data | None yet. The dashboard shows template data | `app/dashboard/data.json` |
| HTTPS | Not configured in the repository. Hosting is not decided | [ARCHITECTURE.md](ARCHITECTURE.md#deployment) |

## Rules from the PRD

These rules come from the PRD and apply to all features. Each one must be checked before the feature is released.

- **Access by role and site.** Each user has a role per site. Users can see and act only on the sites their role covers. The PRD defines three roles: superadmin, HO, and admin site. All three are in the MVP, together with multi-site.
- **Audit history.** Roster history is kept and must not be overwritten.
- **Personal data.** Employee data must be limited to what the roster rules need. The processing must be reviewed against UU PDP.
- **Validated input.** Each row of an Excel import is validated, and a failed row reports its reason (PRD, user stories 7 and 8).

## Rules for the team

- Do not commit `.env`. Copy `.env.example` and fill in the values.
- Do not put real employee data in the repository, in test fixtures, or in documentation. Use made-up data (see [TESTING.md](TESTING.md#test-data)).
- Use a long random value for `BETTER_AUTH_SECRET`. Generate it with `openssl rand -base64 32`.
- Do not add `dangerouslySetInnerHTML` with data that comes from users or from the database.
- Do not expose the database port on a public interface. Production must keep the `127.0.0.1` binding.

## Planned work

The items below are not done. They are listed in the order they should be done. Items 1 to 3 block the roster features.

1. **Protect the admin pages on the server, in two layers.**
   - **Optimistic check in `proxy.ts`.** Next.js 16 renamed `middleware.ts` to `proxy.ts`. It reads the session cookie only and redirects users who are not logged in to `/sign-in`. It must not query the database, because it runs on every route, including prefetches.
   - **Secure check in a Data Access Layer.** Verify the session against the database in a server-only module. Every page, layout data loader, server action, and route handler that reads or changes roster data must call it. Proxy alone is not enough, because the Next.js authentication guide says most security checks should sit close to the data source.
2. **Build the role-per-site model.** Define the three roles (superadmin, HO, and admin site), and store the site assignment for each user. Check the role on every roster action on the server, not only in the UI.
3. **Make the auth configuration environment-driven.** Read `baseURL` from the environment instead of the hardcoded value in `lib/auth.ts` (see [ARCHITECTURE.md](ARCHITECTURE.md#configuration)).
4. **Decide on email verification and password reset.** Both are needed before real users sign up. The better-auth documentation covers both.
5. **Add rate limiting to the auth endpoints.** Brute-force attempts on login should be limited. Check the better-auth documentation for the built-in option before writing a custom one.
6. **Add security headers and a Content Security Policy.** Set them in `next.config.ts` with `headers()`.
7. **Validate Excel imports.** Limit the file size and the number of rows. Validate each row against the schema, and reject the file type if it is not the expected template.
8. **Record roster changes in an audit log.** Store who changed what and when. Do not allow edits or deletes of those records from the app.
9. **Serve production over HTTPS.** Choose the hosting first. The hosting decision is open (see [ARCHITECTURE.md](ARCHITECTURE.md#known-gaps)).
10. **Review the PDP obligations.** Confirm the legal basis for processing employee data, the retention period, and the process for data access and deletion requests. This is a legal review, not a code task.

## Reporting a vulnerability

No reporting channel is defined yet. Add one before the first user outside the team gets access. Until then, report issues to the project owner directly.
