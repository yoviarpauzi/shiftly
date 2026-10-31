# Testing

This document describes how Shiftly is tested. It covers the checks that exist today and the test strategy for the roster rules, which is planned but not built yet. The rules themselves are defined in the [PRD](PRD.md), and the system structure is described in [ARCHITECTURE.md](ARCHITECTURE.md).

## Current status

The test runner is Vitest 5.0.5, configured in `vitest.config.mts`. It is set up, but there are no test files yet. `bun run test` exits with code 1 until the first `*.test.ts` file exists. No CI configuration is checked in.

| Check | Command | What it verifies |
| --- | --- | --- |
| Test | `bun run test` | Vitest, runs `**/*.test.ts` in the `node` environment. Use `bun run test:watch` while you work |
| Lint | `bun run lint` | ESLint with the Next.js Core Web Vitals and TypeScript rules (`eslint.config.mjs`) |
| Type check | `bunx tsc --noEmit` | TypeScript with `strict: true` (`tsconfig.json`) |
| Build | `bun run build` | Next.js production build. It fails if the app or its imports are broken |

Run these before you commit a change. Lint and type check currently report errors in existing files. These errors are not caused by the test setup. Fix them before relying on those checks to gate a change.

## Test strategy

The PRD defines the core of the strategy. The rule engine is deterministic, so the same input must always produce the same roster. Every roster rule must have its own unit tests. A generated roster is checked again against the rule list, and any violation counts as a failed test.

Test layers, from the most to the least frequent:

| Layer | What it covers | Status |
| --- | --- | --- |
| Rule unit tests | One set of tests per rule (see [Rule test cases](#rule-test-cases)) | Planned |
| Roster validation tests | A roster produced by the engine passes every rule. Any violation fails the test | Planned |
| Determinism tests | The same input run twice produces the same output | Planned |
| Conflict tests | A rule that cannot be met produces a conflict with a reason. The engine does not drop the rule silently | Planned |
| Import validation tests | Each Excel row is validated, and a failed row reports its reason | Planned (PRD user stories 7 and 8) |
| Authorization tests | Each role can only reach the sites it is assigned to | Planned, after the dashboard is protected on the server |
| Performance check | A weekly roster for one site finishes in under 5 minutes, measured with real data | Planned, before v1.1 |

The MVP exit criterion ("valid roster for 2 weeks at one site") is checked in operation, not by an automated test.

### Rule test cases

Each rule needs cases for a valid input, an invalid input, and the boundary between them. Write the boundary cases first, because the PRD leaves some boundaries open.

| Rule | Cases to cover | Open question |
| --- | --- | --- |
| Work pattern | 5 and 7 working days per week. Reject a pattern that is neither | None |
| Shift change | Allowed: 1 → 2, 2 → 3, 1 → 3. Rejected: 2 → 1, 3 → 1, 3 → 2 | Whether the 7-working-day exception must be consecutive |
| Shift change exception | An employee with 7 working days can move to a lower shift number | Whether the exception also applies to the lower shift move |
| Break | 4 days of break in each 3-month cycle | Whether the break is given once per 3 months |
| Annual off | 20 days per employee per year. Reject a plan that exceeds the balance | Whether 20 is per calendar year |
| Department grouping | An employee can belong to several departments. Overlapping schedules are flagged | Which department wins on overlap |

Mark each test with the open question it depends on, and update the test when the PRD answer changes.

## Test data

- Do not put real employee data in the repository or in test fixtures. Employee data is personal data under the UU PDP (see the PRD).
- Build fixtures from made-up employees, sites, and departments. Keep each fixture small enough to read, and name the case it covers.
- Keep the shift history needed by the shift-change rule in the fixture: last shift and count of consecutive working days.

## Writing a test

Follow these conventions. The folder layout is not decided yet (see [Open decisions](#open-decisions)).

- One test file per rule or per engine module.
- Test names describe the rule and the case, for example `rejects shift change from 3 to 2 before 7 working days`.
- A test checks one behavior. Use separate tests for the valid case and the invalid case.
- Determinism tests run the same input twice and compare the full output, not only a summary.

## Definition of done for a rule change

A change to a roster rule is done when all of the following pass:

1. The rule has unit tests for valid, invalid, and boundary cases.
2. Roster validation tests still pass, because the change may affect a rule that is already covered.
3. Determinism tests still pass.
4. Lint, type check, and build pass (see [Current status](#current-status)).
5. The PRD open question that the change depends on is updated or linked.

## Open decisions

- **Folder layout.** Not chosen. Options are tests next to the source files or a separate `tests/` folder.
- **End-to-end tests.** Not planned for the MVP. Decide after the roster UI exists, and only if the UI flow needs automated coverage.
- **CI.** Not set up. Decide where lint, type check, build, and tests should run.
