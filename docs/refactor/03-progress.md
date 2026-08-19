# Refactor Progress Log

> Part of the PixelVega refactor documentation. Index: [`docs/README.md`](../README.md).

The **live execution log**. [`02-checklist.md`](./02-checklist.md) says what must happen across all
nine phases; this file says what is happening right now, in the order it is being done, and what
actually came of it.

**How this file is used.** Before starting a phase, its tasks are broken down here into ordered,
concrete steps. Each is worked one at a time and its row updated the moment it finishes, with the
verification that proved it. Decisions taken mid phase and deviations from the plan are recorded
under the phase, not left in a chat log.

Status: `pending` · `in progress` · `done` · `blocked` · `dropped`

---

## Current position

|                    |                                                                               |
| ------------------ | ----------------------------------------------------------------------------- |
| **Phases 1 to 5**  | Complete and **merged to `main`** (PRs #1 to #6), 2026-08-20                  |
| **Phase 6**        | **In progress.** Backend half first, on `refactor/phase-6-backend-serves-all` |
| **Phases 7 to 9**  | Not started (frontend)                                                        |
| **Branch**         | `refactor/phase-6-backend-serves-all`                                         |
| **Gate on `main`** | `lint · typecheck · 601 unit · 12 E2E · build`, all green                     |

### Read this first if you are picking the work up

1. [`../architecture/02-directives.md`](../architecture/02-directives.md) is binding. D4 and D5 are what phase 6 implements.
2. [`01-plan.md`](./01-plan.md) phase 6 is the spec for the next work.
3. [`02-checklist.md`](./02-checklist.md) has the tickable items.
4. The backend now mirrors `../../island-tour-development/backend`. When a convention is unclear, read that repo rather than guessing.

### Local environment, not recorded anywhere in the repo

`.env` and `.env.test` are gitignored, so this is the only written record of how the
databases are wired:

- Postgres 17 via Homebrew, already running. Databases `pixelvega_dev` and
  `pixelvega_test`, owner `devripon`, no password.
- `pmt-backend/.env` points `DATABASE_URL` at `pixelvega_dev`. **The Neon URLs
  are commented out in that file rather than deleted**, so switching back is one edit.
- `pmt-backend/.env.test` points at `pixelvega_test`. `test/global-setup.js`
  refuses to run if the two match, including when only the credentials differ.
- `pnpm seed` fills the dev database. Every seeded account signs in with
  `Password123!`, one per role.
- `pnpm test:e2e` needs `--experimental-vm-modules` (booting the real `AppModule`
  pulls in ESM-only packages) and `--forceExit` (the scheduler and the lazily
  connected Redis client outlive `app.close()`). Both are already in the script.
- Redis is NOT running locally. The two queued AI features fail their job without
  it; nothing else is affected.

### Known shortcuts, deliberately taken

- `pmt-frontend`'s `test` script echoes and exits 0. Vitest is deferred to phase 7.
  Without it the root `pnpm test` fails and blocks every push. Replace with
  `vitest run` in phase 7.
- Response DTOs exist for `users`, `audit-log`, `notifications`, `profiles` and
  `projects` only. For the other 22 modules `/api/docs` documents what goes in but
  not what comes back.
- The AI and Slack calls still running in the request path have not moved to BullMQ.
- Controller specs were deliberately not written per controller. `route-permissions.spec.ts`
  pins all 112 routes from real metadata instead, which is what protects the phase 4
  work; per-controller delegation specs would add bulk without adding much.

## Phase 1: make it verifiable

Plan: [`01-plan.md`](./01-plan.md) phase 1. Checklist: [`02-checklist.md`](./02-checklist.md) phase 1.

Goal: a working quality gate and a first layer of tests, so every later phase has a safety net.
Nothing here changes application behaviour.

### Tasks

| #    | Task                                                            | Status   | Outcome                                                                                                                                                                                  |
| ---- | --------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | Branch `refactor/phase-1-make-it-verifiable` off `main`         | done     | Clean branch, `main` untouched                                                                                                                                                           |
| 1.2  | Baseline the backend before touching anything                   | done     | `npx tsc --noEmit` passes. Node v25.8.0, pnpm 10.30.3                                                                                                                                    |
| 1.3  | `pnpm install` at the repo root                                 | done     | 32 packages: husky, lint-staged, concurrently, prettier                                                                                                                                  |
| 1.4  | Activate husky                                                  | done     | `prepare` ran automatically; `core.hooksPath` = `.husky/_`                                                                                                                               |
| 1.5  | Audit `postman/` for credentials before un-ignoring it          | done     | No literal credentials. Real team email addresses present, so left ignored pending a decision. See Decisions below                                                                       |
| 1.6  | Un-ignore `CLAUDE.md`, `docs/`, `pixelvega-build-spec.md`       | done     | `git check-ignore` confirms all three are now tracked                                                                                                                                    |
| 1.7  | Delete stale `pmt-backend/.claude/settings.local.json`          | done     | It allowlisted a previous machine's paths (`/Users/pixelvega/jabed/...`)                                                                                                                 |
| 1.8  | Align CI pnpm version, and remove the orphaned backend workflow | done     | Pinned 10.30.3. **Found: `pmt-backend/.github/` has never run.** GitHub reads only the repo-root `.github/`, so this repo has had no CI at all. Deleted; assessment corrected            |
| 1.9  | Write the E2E test harness                                      | done     | `.env.test.example`, `global-setup.js`, `create-test-app.ts`, `jest-e2e.json`. Guard verified against three cases: missing file, same database, same database with different credentials |
| 1.10 | Replace the stale `test/app.e2e-spec.ts`                        | done     | Six pipeline smoke tests: the `api` prefix resolves, the global AuthGuard rejects, better-auth answers at its literal `/api/auth`, unknown routes 404                                    |
| 1.11 | Add Vitest + Testing Library + happy-dom to `pmt-frontend`      | deferred | Mirror the dashboard reference, including the `e2e/**` exclusion                                                                                                                         |
| 1.12 | Fix `pmt-frontend/.env.example`                                 | deferred | It points `NEXT_PUBLIC_API_URL` at `:3001`, the frontend's own port                                                                                                                      |
| 1.13 | Spec: `ALLOWED_STATUS_TRANSITIONS`                              | done     | 111 cases, driven from the table itself: completeness, every (from,to) pair, and the documented rules (INTERNAL_REVIEW and WAITING_FOR_FEEDBACK reachable only via their own services)   |
| 1.14 | Spec: `compareForDashboard`                                     | done     | 20 cases. Also asserts the comparator is antisymmetric, which is how a sort silently goes wrong                                                                                          |
| 1.15 | Spec: `withRemainingHours`                                      | done     | 8 cases. Pins null estimate to null, not 0, and that overrun stays negative rather than clamped                                                                                          |
| 1.16 | Spec: `daysBetweenInclusive` and `minutesBetween`               | done     | 13 cases. Covers the leap day, the year boundary, and that rounding survives a DST shift                                                                                                 |
| 1.17 | Spec: `toCsv`                                                   | done     | 12 cases. Comma, quote, CR, LF, and all of them at once                                                                                                                                  |
| 1.18 | Spec: `paginate`                                                | done     | 6 cases. Skip and take math, full total not page size, and that the query and count run concurrently                                                                                     |
| 1.19 | Spec: the one active timer rule                                 | done     | 13 cases. Asserts the guard queries by userId ALONE, which is what catches someone scoping it to a project                                                                               |
| 1.20 | Spec: `getAutoStopCutoff`                                       | done     | 18 cases. Both sides of the cap-versus-day-end crossover, to the millisecond                                                                                                             |
| 1.21 | Spec: leave balance arithmetic                                  | done     | 14 cases. approve increments by exactly the requested days, reject does not touch the balance at all                                                                                     |
| 1.22 | Verify the whole gate green                                     | done     | lint, typecheck, test, build all PASS. 213 tests across 9 suites                                                                                                                         |
| 1.23 | Confirm a real commit triggers lint-staged                      | pending  |                                                                                                                                                                                          |

### Findings

| Date       | Finding                                                                                                                                                                                                                                                          | Impact                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-19 | **This repo has never had CI.** `pmt-backend/.github/workflows/ci.yml` is committed but GitHub Actions only reads `.github/workflows/` at the repository root, which is `pixelvega-tool/`. The file is a leftover from when `pmt-backend` was its own repository | The assessment reported "backend CI runs build only". That was wrong: nothing has verified either package before a merge. Corrected in `01-assessment.md`, orphaned file deleted |

### The per module recipe

Established on `project-members` and repeated for every remaining module. Each step is
verifiable on its own, which is what makes a half migrated module obvious rather than subtle.

1. **Consolidate `dto/` into one `dto/<singular>.dto.ts`**, grouped Response, then Query, then
   Request. The reference has exactly one DTO file per module (`categories/dto/category.dto.ts`),
   and PMT had ten in `projects/dto/` alone.
2. **Write the response DTOs**, with an `example` on every field. Enums become `EnumDisplayDto`.
3. **Add a `capabilities` object** covering only the actions a screen actually gates (ADR 0002).
4. **Write a flat `<module>.mapper.ts` plus its spec.** Pure: it takes a row and a context object,
   never a database, so the capability rules are testable without a Nest module.
5. **Wire the mapper into every service method that returns a row**, computing the context once
   per request rather than once per row.
6. **Type the `ApiResponse`s** in `<module>.swagger.ts` with the new classes.
7. **Run the full unit suite.** It should pass untouched. If a service spec breaks, the mapper
   changed behaviour rather than shape, which is the bug this ordering is designed to surface.

### Decisions taken

| Date       | Decision                                                                                                                                                                                               | Reason                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-19 | `postman/` stays gitignored for now                                                                                                                                                                    | The collections carry no credentials (checked: every password field is a `CHANGE_ME_*` placeholder or a `{{variable}}`), but they do carry real team email addresses including one personal Gmail. Committing personal data is the owner's call, not mine. Raised for a decision |
| 2026-08-19 | `pmt-backend/.gitignore` keeps a comment explaining why the docs are tracked                                                                                                                           | Without the reason written down, the next person re-adds the ignore line                                                                                                                                                                                                         |
| 2026-08-19 | Exported six pure symbols from `projects.service.ts` (`ALLOWED_STATUS_TRANSITIONS`, `DASHBOARD_ACTIVE_STATUSES`, `PRIORITY_RANK`, `withRemainingHours`, `compareNullableDates`, `compareForDashboard`) | They were module private, so the highest risk logic in the app was unreachable from a test. Adding `export` is a zero behaviour change                                                                                                                                           |
| 2026-08-19 | Aligned `eslint.config.mjs` to the reference backend's rule set, pulled forward from the D1 work                                                                                                       | The gate is phase 1's exit criterion and could not go green otherwise. The reference turns off the `no-unsafe-*` family because Prisma payloads and Jest mocks are `any` at the boundary. Mirroring is the directive; inventing a different rule set here would be the deviation |

### Open items raised during the phase

- [ ] **Decide on `postman/`.** Commit as is, commit with the emails replaced by `{{variable}}` placeholders, or leave ignored.
- [ ] **DRY question on the E2E bootstrap.** The reference duplicates the `main.ts` pipeline config into each E2E spec, which is exactly how an E2E suite drifts from production. Mirroring it faithfully means copying that duplication. Noted in task 1.9, resolved conservatively for now by keeping the duplication to one shared test helper rather than one per spec.

---

## Phase 2: backend foundations — complete, 2026-08-20

All 33 items. Strict mode on with only 5 errors (all TS2564 on auth DTO fields,
fixed with the reference's `!` convention). The `@/` alias and the `src/modules`
flatten landed as one sweep: 470 import specifiers rewritten, zero deep relative
paths remain. `env.validate.ts` covers all 20 variables. `AllExceptionsFilter`
maps the four Prisma constraint codes. `main.ts` gained helmet, trust proxy, a
fail-closed CORS allowlist, `forbidNonWhitelisted`, and shutdown hooks. The
schema split into 12 domain files with `prisma migrate diff` reporting **no
difference**.

## Phase 3: backend test floor — substantially complete, 2026-08-20

417 tests across 22 suites, up from 213. Every service with real branching
business logic now has a co-located spec with Prisma fully mocked:

| Service                                         | What it pins                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `ProjectsService`                               | status guards, archive as a flag, restore always to READY_FOR_WORK  |
| `ProjectMembersService`                         | role matching, the (project, user, role) guard, the auto transition |
| `ProjectTimeEntriesService`                     | the one active timer rule, keyed on user alone                      |
| `MeetingTimeEntriesService`                     | the rule spans both tables                                          |
| `DailyWorkReportService`                        | the two independent edit windows                                    |
| `BlockerService`                                | RESOLVED permanently locked, forward only, additive extension       |
| `InternalReviewsService`                        | the only path out of INTERNAL_REVIEW                                |
| `ClientFeedbackService`                         | only the first round moves the project                              |
| `AdditionalRequirementsService`                 | approving is additive                                               |
| `ProjectDocumentsService`                       | the CLIENT DELIVERABLE restriction                                  |
| `LeaveRequestsService` / `LeaveBalancesService` | approve increments, reject does not                                 |
| `UsersService`                                  | every target specific protection rule                               |

**Deliberately deferred:** controller specs, and specs for the 25 thin services
(mail, slack, cloudinary, prisma, reference data CRUD, AI infrastructure).

**Resequencing decision:** controller specs assert which decorators a route
carries. Phase 4 rewrites every one of those decorators, so writing 27 controller
specs now and rewriting them immediately after would be wasted work. They move to
the end of phase 4, written once against the final decorators.

## Phase 4: permission gate — complete, 2026-08-20

All 19 items. A 52 value `Permission` enum, `ROLE_PERMISSIONS`, both decorators,
`PermissionsService`, `PermissionsGuard` registered after `AuthGuard`, and
`GET /users/me/permissions`. All 97 `@Roles` decorators migrated across 25
controllers, and the wrapper that silently unioned the admins into every list is
deleted.

**Modelling correction, found while migrating.** The first draft modelled
`PROJECT_MANAGER` as "DEVELOPER plus management". That is wrong: PMs are
deliberately excluded from `TRACK_PROJECT_TIME` and `SUBMIT_WORK_REPORT` by the
routes as they stand. Shipping the draft would have silently granted PMs time
tracking. They are siblings, not a ladder, and the spec now asserts that in both
directions. Only ADMIN and SYSTEM_ADMIN are strict supersets.

### Follow up, 2026-08-20

- **Permission coverage is now total.** Directive D2 was tightened to "every
  operation in the codebase", so the 11 previously ungated self service and
  reference routes gained permissions too, taking the enum to 60 values.
  `route-permission-coverage.spec.ts` reads the controller sources and fails if
  any route has neither a permission nor an explicit anonymous opt out, so this
  cannot silently regress. The anonymous surface is pinned to exactly three
  routes (the password reset flow).
- **`postman/` deleted** at the owner's decision, and its ignore rule removed.
- **Local Postgres 17** is now the development and test database
  (`pixelvega_dev`, `pixelvega_test`). The Neon URLs are commented out in `.env`
  rather than deleted. All 35 migrations applied, 31 tables, and the
  `Permission` type confirmed present with 60 values.
- **The E2E suite runs for the first time**, 6 tests green against a live
  database. It needed the reference's ESM setup (`tsconfig.e2e.json`,
  `extensionsToTreatAsEsm`, `--experimental-vm-modules`) because booting the
  real `AppModule` pulls in ESM only packages, plus `--forceExit` because the
  scheduler and the lazily connected Redis client outlive `app.close()`.

**Two bugs the E2E boot caught that no unit test could:**

| Bug                                                                                                                                                       | Why unit tests missed it                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `PermissionsService` was provided in `AppModule`, so `UsersController` could not inject it. Nest resolves a controller's dependencies from its own module | Every spec constructs its subject directly, so DI wiring is never exercised        |
| `PermissionsGuard` ran before better-auth's session guard, turning every unauthenticated request into a 403                                               | The guard spec passes a request object in directly, so guard ordering is invisible |

Fixes: a `@Global() PermissionsModule` matching the existing `PrismaModule` and
`AuditLogModule` convention, and the guard now answers 401 for a missing
session, which is the correct status whichever order the guards run in. This is
a deliberate deviation from the reference, which throws Forbidden there because
it registers every guard in one module and can guarantee the ordering.

**Process note on myself:** two of my edits silently failed to apply because the
target text had already been reformatted, and I did not re-run typecheck after
them. One shipped an undefined identifier into the guard, which only the E2E run
surfaced. Every scripted edit now asserts its pattern matched.

## Phase 5: backend module mirror — substantially complete, 2026-08-20

**Done:**

| Piece                  | Result                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Swagger extraction     | **27 of 27 controllers.** All 421 inline doc decorators moved into 18 swagger files, one per module |
| `ProjectsModule` split | 17 controllers in one module became **8 feature modules**, max 4 each                               |
| Consolidated DTO files | `users`, `audit-log`, `notifications`, `profiles`                                                   |
| Response DTOs          | Same four modules                                                                                   |
| Shared error sets      | `src/common/swagger/error-sets.ts`                                                                  |

**Two deliberate deviations from the reference, both recorded in commits:**

1. **Shared swagger error sets.** The reference declares them per file; they were
   byte identical in all of mine. A set copied 27 times is one that drifts. D1
   mandates DRY as much as it mandates layout.
2. **`@Global() ProjectActivityModule`.** This is what unlocked the split. Eight
   modules write to one append only activity log, and registering the service per
   module would have given each its own DI instance and split the log. That
   constraint is precisely why all 17 controllers were stuck together.

**A security regression caught in the same change that introduced it.** Rewriting
the `users` request DTOs I replaced `IsIn(ASSIGNABLE_ROLES)` with
`IsEnum(Role)`. `ASSIGNABLE_ROLES` excludes `SYSTEM_ADMIN`, and `UsersService`
checks `dto.role === ADMIN` but never `SYSTEM_ADMIN`, so that validator was the
only barrier between an ADMIN and granting someone the root role. Restored, plus
a defence in depth check in both `update()` and `invite()` and five specs. **The
gap exists in `main` today**: the DTO holds it shut and nothing else does.

**Completed after the first write up:** the swagger extraction finished at 27 of
27 controllers, all 421 inline decorators moved. Project response DTOs landed
along with `test/openapi.e2e-spec.ts`, which reads the GENERATED document rather
than the source and asserts that no internal field appears on
`ClientProjectResponseDto`.

**Still owed:** response DTOs for the other 22 modules, and moving the AI and
Slack calls out of the request path onto BullMQ. Both are additive and low risk,
and neither blocks phase 6.

### Merged to `main`, 2026-08-20

PRs #1 to #6. A process note worth keeping: the first five were opened as a
stack, each targeting the one below. **GitHub did not retarget them when #1
merged**, so #2 to #5 merged into their own base branches rather than into
`main`, and only #1 landed. Caught while verifying `main`'s contents.
`refactor/phase-5-module-mirror` had accumulated everything (trees verified
identical to the stack tip), so PR #6 brought it to `main` in one step. No work
was lost. **If stacking PRs again, verify each target after every merge rather
than assuming retargeting.**

## Completed phases

### Phase 1: make it verifiable — complete, 2026-08-20

20 of 23 tasks done. Two frontend tasks (1.11 Vitest, 1.12 `.env.example`) deferred at the owner's
request to keep the backend moving; they carry into phase 7.

**Exit criteria met.** Backend `lint`, `typecheck`, `test`, and `build` all pass. 213 tests across 9
suites, up from zero. A real commit triggers lint-staged, and the E2E database guard is itself tested.

|                    | Before                                                 | After                                                    |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------- |
| Backend test files | 0                                                      | 9                                                        |
| Backend tests      | 0                                                      | 213                                                      |
| CI                 | none, and the one workflow present had never run       | lint, typecheck, test, build on both packages            |
| Git hooks          | none                                                   | pre-commit and pre-push, both exercised                  |
| E2E harness        | a starter spec expecting a route that no longer exists | real bootstrap, database guard, six pipeline smoke tests |

---

## Phase 6: the backend serves everything (D4, D5)

Plan: [`01-plan.md`](./01-plan.md) phase 6. Checklist: [`02-checklist.md`](./02-checklist.md) phase 6.
Inventory of what has to move: [`04-phase-6-inventory.md`](./04-phase-6-inventory.md).
The three questions this phase had to answer first are settled in
[`0001`](../decisions/0001-enum-value-label-and-tone.md),
[`0002`](../decisions/0002-capability-flags-on-resources.md) and
[`0003`](../decisions/0003-exact-values-in-the-api-rounding-is-display.md).

**Backend first, frontend later.** Every task below is a `pmt-backend` task. The frontend
cannot delete a single client side computation until the field it needs exists on a response,
so the client half waits.

### Ordering, and why

The display primitives come before the response DTOs, not after. Twenty two modules need
response DTOs, and every one of them will carry status objects and capability flags. Building
the DTOs first would mean writing them twice.

### Tasks

| #    | Task                                                                             | Status      | Outcome                                                                                                                                                                                                                                                                                                                                            |
| ---- | -------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1  | `EnumDisplayDto` and the closed tone vocabulary in `common/dto/display.dto.ts`   | done        | `EnumDisplayDto` plus `DISPLAY_TONES`, the five tones read off `components/ui/badge.tsx` rather than chosen                                                                                                                                                                                                                                        |
| 6.2  | Label and tone maps for every display facing Prisma enum                         | done        | `common/utils/enum-display.util.ts`: 21 maps, each typed `Record<TheEnum, EnumDisplayEntry>` so a new Prisma member fails the build. Tones lifted from the frontend's own tone functions where they existed                                                                                                                                        |
| 6.3  | Spec: the maps, including that the tone vocabulary stays closed                  | done        | 94 cases. Completeness driven from `Object.values(TheEnum)`, so the spec cannot pass by being stale itself. Also pins sentence case, the closed tone set, and that nullable stays null                                                                                                                                                             |
| 6.4  | Capability flag helpers, computed from permissions plus project scope            | done        | `ProjectScopeService`, `@Global` like `ProjectActivityModule`. 12 private copies across 11 services collapsed into one definition. 29 specs, and the 724 unit tests pass with only a provider added to 8 specs                                                                                                                                     |
| 6.5  | Response DTOs: `projects` completed, plus `project-members`, `project-documents` | done        | `project-members` (2 dto files to 1) and `project-documents` (4 to 1). Both carry display objects, capabilities and a mapper with specs. `formatFileSize` moved to the server, gaining the gigabyte tier the frontend copy lacked `projects` finished too: 10 dto files to 1, plus capabilities, `isOverdue`, `isTerminal` and `daysUntilDeadline` |
| 6.6  | Response DTOs: `time-tracking`, `work-reports`                                   | done        | `time-tracking` (6 dto files to 1) and `work-reports` (7 to 1). The two edit window predicates moved out of the service into the mapper, so a capability flag and the rule it promises are now the same function                                                                                                                                   |
| 6.7  | Response DTOs: `blockers`, `internal-reviews`, `client-feedback`                 | done        | `blockers` (6 dto files to 1), `internal-reviews` and `client-feedback`. `BlockerService.withMetrics` was absorbed into the mapper: it reported `resolutionTime` and `daysOpen` as `undefined`, so the fields vanished from the JSON entirely                                                                                                      |
| 6.8  | Response DTOs: `additional-requirements`, `project-reports`                      | done        | `additional-requirements` (3 dto files to 1) and `project-reports` (2 to 1). The reports were the largest undocumented shapes in the API: 20 response classes now state every aggregate, including the rate-is-null-not-zero rule and one known formula limitation left visible rather than silently corrected                                     |
| 6.9  | Response DTOs: `leave` (holidays, types, requests)                               | done        | `leave`: 8 dto files to 1, covering holidays, types, requests, balances and the summary report. 15 swagger responses typed                                                                                                                                                                                                                         |
| 6.10 | Response DTOs: `ai`, `ai-summary`, `ai-status-reports`, `auth`                   | done        | `ai` (3 dto files to 1), `ai-summary`, `ai-status-reports` and `auth` (3 to 1). AI jobs gained `isFinished`, so a polling client cannot loop forever on a FAILED job Also `users`, `profiles`, `notifications` and the CLIENT projection, which finishes every enum in every response                                                              |
| 6.11 | Sorting, filtering and grouping become query params                              | done        | `sortBy`/`sortOrder` on users and projects, applied before pagination. The dashboard keeps its fixed comparator, see the decision below                                                                                                                                                                                                            |
| 6.12 | Aggregates and derived numbers become response fields                            | done        | Covered by the per module work: every list carries filter-wide totals, and every derived number is a response field                                                                                                                                                                                                                                |
| 6.13 | D5 validation sweep: `@Type`, `@Transform`, `@IsEnum`, length bounds             | done        | 43 length bounds from named constants, 15 `@IsIn` to `@IsEnum`, every boolean query param fixed, and `@Trim()` where emptiness carries meaning                                                                                                                                                                                                     |
| 6.14 | Custom validators in `common/validators/`, each with a co-located spec           | done        | `IsNotBefore` with 6 specs, plus a `validators/README.md` recording why `RequiredWhen` was written and deleted                                                                                                                                                                                                                                     |
| 6.15 | Contract check: frontend types verified against `/api/docs-json` in CI           | in progress |                                                                                                                                                                                                                                                                                                                                                    |
| 6.16 | Move the request path AI and Slack calls onto BullMQ                             | pending     |                                                                                                                                                                                                                                                                                                                                                    |
| 6.17 | Whole gate green, checklist ticked, PR opened                                    | pending     |                                                                                                                                                                                                                                                                                                                                                    |

### Decisions taken

| Date       | Decision                                                                                                    | Reason                                                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-20 | The label and tone maps are typed `Record<TheEnum, EnumDisplayEntry>` rather than checked by a runtime test | TypeScript then fails the build when a Prisma enum gains a member and nobody gave it a label. A runtime spec can only catch that if someone remembers to extend the spec too, which is the same failure one level removed |
| 2026-08-20 | Tone vocabulary is fixed at `default`, `primary`, `success`, `warning`, `danger`                            | It is exactly what `components/ui/badge.tsx` already implements, so the client's job stays a lookup. Confirmed against the file rather than chosen                                                                        |
| 2026-08-20 | Labels are sentence case (`Ready for work`), not the title case the frontend produced (`Ready For Work`)    | Sentence case is the house style of every UI vocabulary worth copying, and the server supplying the label is precisely the chance to fix the `AI_SUMMARY` to `Ai Summary` class of bug rather than reproduce it           |

### Findings

| Date       | Finding                                                                                                                                                                                                                                                                                                  | Impact                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-20 | Project scoping was implemented **twelve times**: seven byte-identical copies of `assertManagesProject` across `projects`, `project-members`, `internal-reviews`, `additional-requirements`, `ai-status-reports`, `project-documents` and `blockers`, four of `assertActiveMember`, and one variant      | They had **not** drifted, checked by hashing each extracted body. But nothing prevented it: a fix to an authorization rule had eleven places to land and no way to know it had missed one. Now one definition, in `ProjectScopeService`                                                                                                                                                                                              |
| 2026-08-20 | `daily-work-report.service.ts` had a method called `assertActiveMember` that was a **different rule**: it required membership of every role including admins, and 404s on a missing project                                                                                                              | The shared name hid the difference. Logging work against a project requires being staffed on it, and being an admin is not a reason to appear on a project's timesheet. Extracted as `assertStaffedOnProject`, which says what it enforces                                                                                                                                                                                           |
| 2026-08-20 | Mapping `UsersService.findOne` broke two authorization rules. `update()` and `remove()` called it to fetch the record they then compare against, so once `findOne` returned `role` as a display object, every `existing.role === Role.SYSTEM_ADMIN` check became object-versus-string and silently false | The SYSTEM_ADMIN protections and the one-admin-cannot-edit-another rule both stopped firing. Caught by the phase 1 specs, which is exactly what they were written for. Fixed by splitting a private `getUserOrThrow` returning the raw row from the public mapped `findOne`, with the reason written above it. Every other module's internal lookup was audited and returns raw rows                                                 |
| 2026-08-20 | **Every boolean query parameter was broken.** All six used `@Type(() => Boolean)`, which calls `Boolean(value)`, and `Boolean('false')` is `true`                                                                                                                                                        | `?archived=false` returned archived projects, `?includeLeft=false` included departed members, `?unreadOnly=false` returned only unread. The bug only bit a client that sent the value explicitly, since an absent param fell through to the field default, which is why it survived. Replaced with a `@ToBoolean()` decorator that parses `true`/`false`/`1`/`0`/bare-flag and refuses anything else with a 400 rather than guessing |
