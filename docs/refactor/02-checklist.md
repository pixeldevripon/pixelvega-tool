complet all # Refactor Checklist

> Part of the PixelVega refactor documentation. Index: [`docs/README.md`](../README.md).

The task list for [`01-plan.md`](./01-plan.md). The plan carries the phases and their reasoning; the
constraints are in [`../architecture/02-directives.md`](../architecture/02-directives.md) and the
shapes in [`../architecture/03-target-architecture.md`](../architecture/03-target-architecture.md).
This file carries only the work. Read the plan's section for a phase before starting it.

**Tick items in the same PR as the work.** A stale checklist is worse than no checklist, because the
next person trusts it. When an item turns out to be wrong or unnecessary, strike it and say why rather
than silently deleting it.

Legend: `[ ]` not started · `[x]` done · `[~]` in progress · `[-]` dropped, with a reason

## The five directives

Every item below serves one of these. They are binding constraints, not preferences. Full text in the
[`../architecture/02-directives.md`](../architecture/02-directives.md).

|        | Directive                                             | Shorthand                                                                                                                   |
| ------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **D1** | The backend mirrors `island-tour-development/backend` | Modules at `src/<module>/`, no `modules/` wrapper. Same file naming, module anatomy, conventions, and code style throughout |
| **D2** | Authorization is a granular permission gate           | `Permission` enum + `ROLE_PERMISSIONS` + `@RequirePermissions()` + `PermissionsGuard`. `@Roles()` retires                   |
| **D3** | The Prisma schema is split by domain                  | One `.prisma` file per domain, merged by Prisma 7                                                                           |
| **D4** | The backend serves everything                         | The frontend performs no computation, transformation, or derivation. It renders what the API returns                        |
| **D5** | Validation is owned by the backend                    | The DTO is the specification. The frontend's Zod schema is a convenience, never the gate                                    |

> **Two hard ordering constraints.** Phase 1 blocks everything. Phase 3 blocks Phase 5. Restructuring
> untested business logic is how a working system quietly stops working, so do not reorder those.
> Phase 6 blocks Phase 8: the frontend cannot become presentation only until the backend serves
> complete payloads.

---

## Progress

| Phase | Scope                         | Directive | Items | Status      |
| ----- | ----------------------------- | --------- | ----- | ----------- |
| 0     | Agent and repo scaffolding    |           | 12    | Done        |
| 1     | Make it verifiable            |           | 20    | In progress |
| 2     | Backend foundations           | D1 D3 D5  | 33    | Not started |
| 3     | Backend test floor            |           | 17    | Not started |
| 4     | Permission gate               | D2        | 19    | Not started |
| 5     | Backend module mirror         | D1        | 20    | Not started |
| 6     | The backend serves everything | D4 D5     | 21    | Not started |
| 7     | Frontend foundations          |           | 16    | Not started |
| 8     | Frontend module migration     | D4        | 14    | Not started |
| 9     | Documentation and process     |           | 9     | Not started |
| n/a   | Open questions                |           | 4     | Unanswered  |

---

## Phase 0: agent and repo scaffolding

Applied already, listed so the record is complete.

- [x] Root `CLAUDE.md`: module shapes, auth rules, testing, style
- [x] Root `.gitignore` (the repo had none)
- [x] Root `package.json` orchestrator: `dev`, `lint`, `typecheck`, `test`, `build`, `prisma:*`
- [x] `.lintstagedrc.json` at the root and one per package
- [x] `.husky/pre-commit` running lint-staged
- [x] `.husky/pre-push` running prisma generate, lint, typecheck, test, build
- [x] `.github/workflows/ci.yml` covering both packages
- [x] Seven subagents in `.claude/agents/`
- [x] `.claude/agent-memory/` directories, committed
- [x] Skills vendored to `.claude/skills/` and `.agents/skills/`, pinned in `skills-lock.json`
- [x] `/opsx:*` slash commands
- [x] `pmt-frontend/CLAUDE.md` (was a single import line)

---

## Phase 1: make it verifiable

**Blocks every later phase.** Nothing here changes application behaviour. It exists so the rest has a
safety net.

### Activate the gate

- [x] `pnpm install` at the repo root
- [x] `pnpm exec husky init` to activate the hooks (both are already written and executable)
- [x] Confirm a commit triggers lint-staged and a push triggers the full gate
- [ ] Confirm CI runs green on a throwaway branch before relying on it

### Backend hygiene

- [x] Remove `CLAUDE.md`, `docs/`, and `pixelvega-build-spec.md` from `pmt-backend/.gitignore`
- [ ] Commit those files so a fresh clone and CI both have them
- [~] Decide on `postman/`: no credentials found, but real team emails are present. Awaiting the owner's call, see `03-progress.md`
- [x] Delete `pmt-backend/.claude/settings.local.json` (it allowlists a previous machine's paths)
- [x] Delete `pmt-backend/test/app.e2e-spec.ts` (it expects a `GET /` that no longer exists)
- [x] Replace it with a real E2E bootstrap applying the same global prefix, pipes, and filters as `main.ts`
- [x] Point `test/jest-e2e.json` at a dedicated `.env.test` database, with a setup guard that fails loudly if `DATABASE_URL` matches the dev or production value

### First tests, on the highest risk pure logic

Write these before touching anything else. Drive the table driven ones from the table itself, so a new
enum member fails loudly instead of going silently untested.

- [x] `ALLOWED_STATUS_TRANSITIONS`: every legal move, and one rejected illegal move per source status
- [x] `compareForDashboard`: active status first, then priority, then deadline, then planned start, nulls last
- [x] `withRemainingHours`: null estimate stays null, otherwise estimate minus actual
- [x] `daysBetweenInclusive` and `minutesBetween`
- [x] `toCsv`: quoting, embedded quotes, embedded newlines
- [x] `paginate`: skip and take math, response shape
- [x] The one active timer rule: a second start is rejected with 409 on any project
- [x] `getAutoStopCutoff`: the nine hour cap and the UTC day end, whichever comes first
- [x] Leave balance arithmetic: `usedDays` increments on approve, untouched on reject

**Exit criteria.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes from the root. CI
runs all four for both packages. Risk: low, nothing user facing changes.

---

## Phase 2: backend foundations

Directives **D1** (the flatten), **D3** (schema split), **D5** (validation pipe).

### Type safety

- [ ] Add `"strict": true` to `pmt-backend/tsconfig.json`
- [ ] Remove `"noImplicitAny": false`
- [ ] Remove `"strictBindCallApply": false`
- [ ] Remove `"noFallthroughCasesInSwitch": false`
- [ ] Fix the resulting errors by adding types, never `any` and never `@ts-expect-error`
- [ ] If the error count is large, land it per directory with the flag off until the final PR

### Path alias and the flatten, one sweep (D1)

Doing the move and the alias together means the import churn is paid once. Pure file movement, no logic
change.

- [ ] Add `"paths": { "@/*": ["./src/*"] }` to `tsconfig.json`
- [ ] Add `"moduleNameMapper": { "^@/(.*)$": "<rootDir>/$1" }` to the Jest config
- [ ] Move every module from `src/modules/<x>/` to `src/<x>/`
- [ ] Flatten the per feature subdirectories inside `src/modules/projects/` into their own top level modules
- [ ] Rename files to the reference's convention where they differ (`blocker.service.ts` becomes `blockers.service.ts`)
- [ ] Rewrite every internal import to `@/`, removing all 76 deep relative paths
- [ ] Confirm `npx tsc --noEmit`, `pnpm test`, and `pnpm build` all pass, before and after

### Boot safety

- [ ] Write `src/env.validate.ts`: required versus optional, minimum secret lengths, placeholder detection
- [ ] Cover every variable the app reads: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PORT`, `NODE_ENV`, `CORS_ORIGINS`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, the `SMTP_*` set, `MAIL_FROM`, the `CLOUDINARY_*` set, `SLACK_BOT_TOKEN`, `SLACK_DAILY_FEED_CHANNEL_ID`, `ANTHROPIC_API_KEY`, `REDIS_URL`
- [ ] Call `validateEnv()` as the first statement in `bootstrap()`
- [ ] Keep `.env.example` in step with it

### Error handling

- [ ] Write `src/common/dto/error-responses.dto.ts` (400, 401, 403, 404, 409, 429, 500)
- [ ] Write `src/common/filters/http-exception.filter.ts` with the Prisma mapping: `P2002` to 409, `P2003` to 409 with the readable foreign key sentence, `P2025` to 404, `P2014` to 409
- [ ] Register it with `app.useGlobalFilters(new AllExceptionsFilter())`
- [ ] Confirm a duplicate key insert returns 409 with a readable message, not a bare 500

### Bootstrap hardening

- [ ] Call `helmet()` in `main.ts` (already a dependency, never wired in)
- [ ] Set `trust proxy` to 1 so the throttler reads the real client IP
- [ ] Replace the `CORS_ORIGIN || '*'` fallback with a `CORS_ORIGINS` allowlist that fails closed
- [ ] **Behaviour change (D5).** Add `forbidNonWhitelisted: true` to the global `ValidationPipe`. Audit every frontend call site and Postman collection first, and ship it in the same deploy as the CORS change
- [ ] Add `app.enableShutdownHooks()`
- [ ] Leave `bodyParser: false` alone. It is a better-auth requirement, not an oversight

### Split the Prisma schema (D3)

- [ ] Reduce `prisma/schema.prisma` to the generator and datasource blocks plus the index comment
- [ ] Create `enums.prisma`, `user.prisma`, `profiles.prisma`, `projects.prisma`, `documents.prisma`, `time-tracking.prisma`, `work-reports.prisma`, `blockers.prisma`, `reviews.prisma`, `leave.prisma`, `notifications.prisma`, `ai.prisma`, `audit-log.prisma`
- [ ] Point `prisma.config.ts` `schema` at `'prisma/'`
- [ ] `npx prisma validate` and `npx prisma generate` both pass
- [ ] **`npx prisma migrate diff` reports no drift.** The split must be byte identical. A split that changes the schema is a bug, not a migration

### Formatting parity

- [ ] Add `.prettierrc` to `pmt-frontend` matching the backend's

**Exit criteria.** The app boots with strict mode on. A missing env var fails at boot with a named
error. A duplicate key insert returns 409 with a readable message. An unknown request body field
returns 400. `prisma migrate diff` shows no drift. Risk: medium, from the CORS and
`forbidNonWhitelisted` changes only.

---

## Phase 3: backend test floor

**Blocks Phase 5.** Do not restructure before this exists. Use the `unit-test-writer` agent; it carries
the mock factory template.

### Service specs, Prisma fully mocked

- [ ] `ProjectsService`, every branch and every thrown exception
- [ ] `ProjectMembersService`, including the automatic transition out of `PLANNING`
- [ ] `ProjectDocumentsService`, including the revision grouping and the CLIENT `DELIVERABLE` restriction
- [ ] `ProjectTimeEntriesService` and `MeetingTimeEntriesService`
- [ ] `DailyWorkReportService` and `DailyProjectEntryService`, including both edit windows
- [ ] `BlockerService`, including the permanent lock once resolved
- [ ] `InternalReviewsService` and `ClientFeedbackService`, including the first round only status move
- [ ] `AdditionalRequirementsService`, including the additive approve
- [ ] `LeaveRequestsService` and `LeaveBalancesService`
- [ ] `UsersService`, every target specific protection rule
- [ ] `ProfilesService`, `AuditLogService`, `NotificationsService`

### Controller specs

- [ ] One beside every controller, asserting delegation and the decorators present

### E2E against a real test database

- [ ] Invite, first login, forced password change, profile setup
- [ ] Project create, staffing, automatic transition
- [ ] Timer start, pause, stop, with `actualHours` asserted on both pause and stop
- [ ] The concurrent double start race, asserted on final database state as well as on the responses

### Coverage

- [ ] Turn on coverage reporting, agree a floor from where the code actually lands, then ratchet upward

**Exit criteria.** Every service and controller has a co-located spec. CI runs unit and E2E.

---

## Phase 4: permission gate (D2)

**The single highest risk phase.** It changes who can reach what. Phase 3's specs are what make it
safe.

### The enum and the map

- [ ] Draft `enum Permission` from the existing `@Roles` lists plus the service level `assertCanX` rules, then **review the draft before migrating** (open question 3)
- [ ] Add `enum Permission` to `prisma/enums.prisma`, one value per capability across projects, staffing, documents, time tracking, work reports, blockers, reviews, requirements, leave, users, profiles, audit log, AI, and settings
- [ ] Hand write the migration (`migrate dev` needs a TTY that an agent session does not have)
- [ ] `src/config/roles.config.ts` exporting `ROLE_PERMISSIONS: Record<Role, Permission[]>`
- [ ] `roles.config.spec.ts` asserting `SYSTEM_ADMIN` and `ADMIN` are strict supersets of every lower role

### Decorators and guards

- [ ] `src/auth/decorators/require-permissions.decorator.ts` (AND semantics)
- [ ] `src/auth/decorators/require-any-permission.decorator.ts` (OR semantics)
- [ ] `src/auth/decorators/authenticated-user.decorator.ts` and `public.decorator.ts`, matching the reference's naming
- [ ] `src/auth/auth.types.ts` with `AuthenticatedRequest` and `TypedAuthUser`
- [ ] `src/auth/guards/permissions.guard.ts` plus its spec
- [ ] Register it in `AuthModule` as the fourth `APP_GUARD`, after `RolesGuard`
- [ ] Confirm the order is `ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard` and document it in `CLAUDE.md`
- [ ] One resolver service returning the caller's effective set, so the rule lives in exactly one place
- [ ] `GET /users/me/permissions` returning that set

### The migration

- [ ] Replace `@Roles([...])` with `@RequirePermissions(...)` on every route
- [ ] Retire `src/common/decorators/roles.decorator.ts`, the wrapper that silently unioned in `SYSTEM_ADMIN`/`ADMIN`. That union is now explicit in `ROLE_PERMISSIONS`
- [ ] Keep `@Roles()` only for the SYSTEM_ADMIN identity protections in `UsersService`
- [ ] Leave every project scoped `assertCanX()` check exactly where it is. The guard answers capability; the service answers scope
- [ ] A spec per role asserting its effective set, plus an E2E role visibility matrix

**Exit criteria.** No route gated by `@Roles()` except the identity rules. `GET /users/me/permissions`
returns a correct set per role, asserted by a spec. Risk: high.

---

## Phase 5: backend module mirror (D1)

One PR per module. Order: `users` and `profiles` first (smallest, proves the pattern), then `leave`,
`audit-log`, `notifications`, then the project domain.

### Per module, every time

- [ ] `dto/<module>.dto.ts` with Response, then Query, then Request groups in that order
- [ ] `@ApiProperty` with an `example` on every response field, `@ApiPropertyOptional` on optionals, required response fields marked `!`
- [x] `<module>.swagger.ts` with one `applyDecorators()` function per endpoint, and shared error sets composed once
- [x] Move all 305 inline `@ApiResponse` decorators out of the 27 controllers
- [x] Error responses typed from `@/common/dto/error-responses.dto` using `type:`, never `schema:`
- [x] Controller reduced to routing only: no Prisma, no business rules, no try/catch
- [x] Static routes declared above dynamic ones
- [ ] `private readonly logger = new Logger(X.name)` on every mutating service
- [ ] `select:` or a shared `include` const on every query, never a raw row returned
- [ ] Scope rules in named `assertCanX()` helpers, one per rule
- [ ] Pure units as flat sibling files with co-located specs, never a nested subdirectory

### Response DTOs

- [ ] `ProjectResponseDto`
- [ ] `ClientProjectResponseDto`, so the client projection is a typed contract rather than a hand written `select`
- [ ] Response DTOs for every remaining module

### Module splits

- [x] Split `ProjectsModule`'s 13 controllers into `ProjectsModule`, `ProjectStaffingModule`, `ProjectDocumentsModule`, `TimeTrackingModule`, `WorkReportsModule`, `BlockersModule`, `ReviewsModule`
- [x] Keep `ProjectActivityService` reachable by all of them without splitting the activity log across DI instances
- [ ] Break `projects.service.ts` (1,109 lines) along the same seams
- [ ] Keep `ALLOWED_STATUS_TRANSITIONS` and `compareForDashboard` as shared, individually tested units
- [x] Register every new module in `AppModule.imports`
- [ ] Move the AI and Slack calls still running in the request path onto BullMQ

**Exit criteria.** Every module matches the template in [`../architecture/03-target-architecture.md`](../architecture/03-target-architecture.md). No service over 600 lines. No
module with more than four controllers. `/api/docs` shows request and response schemas for every
endpoint. The suite green throughout.

---

## Phase 6: the backend serves everything (D4, D5)

**Blocks Phase 8.** The frontend cannot become presentation only until this is done.

### Inventory

- [ ] List every `useMemo` in `pmt-frontend` that derives, sorts, filters, or aggregates
- [ ] List every `.sort(`, `.filter(`, `.reduce(` under `components/`
- [ ] List every label map, tone map, and permission boolean assembled from a role string
- [ ] That list is this phase's backlog. Nothing is done until every entry has a backend home

### Move computation to response fields

- [ ] Derived numbers as response columns: `remainingHours`, `daysOpen`, `resolutionTime`, totals, percentages
- [ ] Aggregates and roll ups served, never assembled client side
- [ ] The dashboard sort moves from JS after fetching to the query, so a page's contents are correct as well as ordered
- [ ] Sorting, filtering, and grouping become query params wherever the frontend does them today

### Display metadata

- [ ] A status arrives as `{ value, label, tone }`, not a bare enum the client interprets
- [ ] Priority likewise
- [ ] Fix the tone vocabulary as a small closed set, so the client's only job is mapping a tone name onto a class
- [ ] Delete `formatEnumLabel()`, `getStatusTone()`, and `getPriorityTone()` from the frontend once the API supplies all three

### Capability flags

- [ ] Every resource carries `canEdit`, `canArchive`, `canApprove`, `canDelete` as applicable
- [ ] Computed server side from the caller's permissions and the project scope rules
- [ ] The frontend hides what the server says is not permitted, and never re-derives it from a role

### Validation surface (D5)

- [ ] A custom validator in `src/common/validators/` for every rule the built in decorators cannot express, each with a co-located spec
- [ ] Numeric query params carry `@Type(() => Number)`
- [ ] Boolean query params carry an explicit `@Transform`
- [ ] Enum fields use `@IsEnum` against the Prisma enum, never a string union
- [ ] Length bounds on every free text field reaching the database, an email, a Slack message, or an AI prompt

### Publish the contract

- [ ] Generate frontend types from `/api/docs-json`, or add a CI check that the hand written types still match it

**Exit criteria.** Every value any screen renders is a field on a response. A second API consumer could
build the same screens without re-deriving anything.

---

## Phase 7: frontend foundations

- [ ] Add `@tanstack/react-query`, `@tanstack/react-table`, `react-hook-form`, `zod`, `@hookform/resolvers`, `date-fns`
- [ ] `components/providers/query-provider.tsx`, mounted in `app/layout.tsx`
- [ ] Query defaults: 30s stale time, two retries with exponential backoff, refetch on window focus, no retry on mutations
- [ ] Port `lib/api/humane-error.ts` (pure module, no fetch, no React)
- [ ] Port `lib/api/fetch.ts` with jittered retry on 429 and 503, GET only
- [ ] **Change `window.setTimeout` to `setTimeout`** so the client works server side
- [ ] Keep the existing `ApiError` shape so current call sites still compile
- [ ] Keep `lib/api/client.ts` as a thin re-export during the migration
- [ ] `npx shadcn init` against the existing `globals.css` tokens to produce a real `components.json`
- [ ] Re-add the existing primitives through the shadcn CLI
- [ ] Expand `globals.css`: radius ladder, type scale with per step line heights, tracking, motion tokens
- [ ] Keep the existing colour values. They are the product's identity, not a placeholder
- [ ] Port `components/data-table/`: table, toolbar, pagination, empty, skeleton, bulk bar
- [ ] Port `components/data-table/use-table-state.ts` (URL synced page, limit, debounced search, filters)
- [ ] `contexts/role-context.tsx` fed from `GET /users/me/permissions`, never from a hardcoded role check
- [ ] Port `proxy.ts` **with its comments**. Cookie shape only, no network call

**Exit criteria.** One screen migrated end to end, measurably shorter, with a test.

---

## Phase 8: frontend module migration (D4)

One PR per module, ordered by ascending size so the pattern is proven cheaply first.

- [ ] `settings` (92 lines)
- [ ] `reports` (293)
- [ ] `profile` (403)
- [ ] `blockers` (479 + 493)
- [ ] `users-admin` (527)
- [ ] `projects` (581)
- [ ] `audit-logs` (695)
- [ ] `daily-work-reports` (771)
- [ ] `leave-requests` (1,823)
- [ ] `project-detail` (3,339). Split by tab with no behaviour change first, then migrate each tab's data layer separately. Never one PR
- [ ] Land the design token ESLint group as `warn`, then flip to `error`
- [ ] Land the dependency direction ESLint group as `warn`, then flip to `error`
- [ ] Land the **presentation only** ESLint group as `warn`, then flip to `error`: no `.sort(` / `.reduce(` / `.filter(` inside `components/**`, no locally declared status or priority label and tone maps
- [ ] Delete `lib/api/client.ts` once nothing imports it

**Per module, every time:** extract `types/<module>.ts` · write `lib/api/<module>.ts` on `apiFetch` ·
write `hooks/<module>/use-<module>.ts` with its key factory · split into `-list-view`, `-table`,
`-columns`, `-row-actions`, `-form`, `-delete-dialog` · convert forms to React Hook Form and Zod
mirroring the DTO rules · move list state to `useTableState` · **delete every computation the backend
now serves** · write tests for the four view states and the form rules · run `frontend-code-reviewer`
then `migration-reviewer` before opening the PR.

**Exit criteria.** No component over 400 lines. No `useEffect` plus `fetch` remaining. No derivation,
sorting, filtering, or aggregation anywhere under `components/`. All three lint groups at `error`.

---

## Phase 9: documentation and process

- [ ] Real root `README.md`: what it is, how to run it, the port map, the env matrix
- [ ] Adopt the `openspec/` workflow for anything larger than a single PR
- [ ] Keep each package's `CLAUDE.md` updated in the same PR as the change it describes
- [ ] ADR: the permission gate, and why it replaced role checks (D2)
- [ ] ADR: the presentation only frontend, and where the line sits (D4)
- [ ] ADR: backend owned validation, and what the frontend Zod schema is for (D5)
- [ ] ADR: the mirror directive, and what "mirror" does and does not cover (D1)
- [ ] ADR: why TanStack Query and not Server Actions for admin screens
- [ ] Update this checklist and the plan's status line whenever a phase closes

---

## Open questions

Answer these as they come up rather than up front. Each is recorded in [`01-plan.md`](./01-plan.md) with the
reasoning.

- [ ] Is `postman/` safe to commit, or does it carry real credentials?
- [ ] What deploys where, and how? The CORS and cookie domain work in Phase 2 needs the real production origins
- [ ] How granular should `Permission` be? Draft it from the existing `@Roles` lists plus the `assertCanX` rules, then review before migrating
- [ ] What coverage floor, measured after Phase 3 rather than picked now?
