# Refactor Plan

> Part of the PixelVega refactor documentation. Index: [`docs/README.md`](../README.md).

Nine phases, backend first. The reasoning is in
[`../architecture/01-assessment.md`](../architecture/01-assessment.md), the constraints in
[`../architecture/02-directives.md`](../architecture/02-directives.md), and the shapes in
[`../architecture/03-target-architecture.md`](../architecture/03-target-architecture.md).

The tickable task list is [`02-checklist.md`](./02-checklist.md). **Tick it in the same PR as the
work.**

---

## The phases

Each phase is independently shippable and leaves the repo working. Two ordering constraints are hard:
**Phase 1 blocks everything**, and **Phase 3 blocks Phase 5**, because restructuring untested business
logic is how a working system quietly stops working.

The backend runs first, phases 1 through 6. The frontend cannot become presentation only until the
backend serves complete payloads, so phases 7 and 8 genuinely depend on phase 6.

### Phase 0: agent and repo scaffolding (done)

Applied already. See [What Phase 0 already installed](#what-phase-0-already-installed) below for the file list.

### Phase 1: make it verifiable

Nothing here changes application behaviour. It exists so every later phase has a safety net.

1. `pnpm install` at the root, then `pnpm exec husky init` to activate the hooks Phase 0 wrote.
2. Add Vitest, Testing Library, and happy-dom to `pmt-frontend`, mirroring the dashboard reference
   including the `e2e/**` exclusion.
3. Delete `pmt-backend/test/app.e2e-spec.ts` and replace it with a real bootstrap that applies the same
   global prefix, pipes, and filters as `main.ts`, pointed at a dedicated `.env.test` database with a
   setup guard that fails loudly if it matches the dev or production URL.
4. Write the first specs against the highest risk pure logic: the status transition table driven from
   the table itself, the dashboard comparator, `withRemainingHours`, the date and CSV utilities,
   `paginate`, the one active timer rule, `getAutoStopCutoff`, and leave balance arithmetic.
5. Un-ignore `CLAUDE.md`, `docs/`, and the build spec in `pmt-backend/.gitignore`, and commit them.
6. Fix `pmt-frontend/.env.example`: the API URL is `:3000`, not `:3001`.
7. Delete the stale `pmt-backend/.claude/settings.local.json`.

**Exit criteria.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes from the root. CI
runs all four for both packages. **Risk: low.**

### Phase 2: backend foundations

1. **Strict mode.** Add `"strict": true`, remove `noImplicitAny: false`, `strictBindCallApply: false`,
   and `noFallthroughCasesInSwitch: false`. Fix by adding types, never `any`. Land per directory with
   the flag off until the last PR if the error count is large.
2. **Path alias and the flatten, in one sweep (D1).** Add `"paths": { "@/*": ["./src/*"] }` and the
   Jest `moduleNameMapper`, move every module from `src/modules/<x>/` to `src/<x>/`, flatten the
   per feature subdirectories inside `src/modules/projects/`, and rewrite every import to `@/`. Doing
   the move and the alias together means the import churn is paid once.
3. **`src/env.validate.ts` (D5 adjacent).** Required versus optional, minimum secret lengths,
   placeholder detection. Called first in `bootstrap()`. Keep `.env.example` in step.
4. **`src/common/dto/error-responses.dto.ts` and `src/common/filters/http-exception.filter.ts`.** Port
   both, including the Prisma mapping: `P2002` to 409, `P2003` to 409 with the readable foreign key
   sentence, `P2025` to 404, `P2014` to 409. Register the filter globally.
5. **Harden `main.ts`.** `helmet()`, `trust proxy`, a `CORS_ORIGINS` allowlist that fails closed,
   `forbidNonWhitelisted: true`, `enableShutdownHooks()`.
6. **Split the Prisma schema (D3).** Move every model into the domain files listed in D3 and point
   `prisma.config.ts` at `'prisma/'`. Verify `npx prisma validate` and `npx prisma generate`, then
   confirm `npx prisma migrate diff` reports no drift: the split must produce a byte identical schema.
7. Add `.prettierrc` to `pmt-frontend` matching the backend's.

**Exit criteria.** The app boots with strict mode on. A missing env var fails at boot with a named
error. A duplicate key insert returns 409 with a readable message. An unknown request body field
returns 400. `prisma migrate diff` shows no drift after the split. **Risk: medium**, entirely from
items 5 and the `forbidNonWhitelisted` change. Audit every frontend call site and Postman collection
before merging it, and ship it in the same deploy as the CORS change.

### Phase 3: backend test floor

**Blocks Phase 5.** Do not restructure before this exists.

1. A `*.service.spec.ts` beside every service, Prisma fully mocked, covering every branch and every
   thrown exception. Use the `unit-test-writer` agent; it carries the mock factory template.
2. A `*.controller.spec.ts` beside every controller, asserting delegation and the decorators present.
3. Backend E2E for what a unit test cannot prove: invite through first login through forced password
   change; project create through staffing through the automatic transition; the timer lifecycle with
   `actualHours` asserted on both pause and stop; the concurrent double start race.
4. Turn on coverage reporting, agree a floor from where the code actually lands, then ratchet upward.

**Exit criteria.** Every service and controller has a co-located spec. CI runs unit and E2E.

### Phase 4: permission gate (D2)

1. Add `enum Permission` to `prisma/enums.prisma` (Phase 2 created the file), one value per capability
   across projects, staffing, documents, time tracking, work reports, blockers, reviews, requirements,
   leave, users, profiles, audit log, AI, and settings. Hand write the migration.
2. `src/config/roles.config.ts` with `ROLE_PERMISSIONS`, plus a spec asserting that `SYSTEM_ADMIN` and
   `ADMIN` are strict supersets of every lower role.
3. `src/auth/decorators/require-permissions.decorator.ts` and `require-any-permission.decorator.ts`.
4. `src/auth/guards/permissions.guard.ts` plus its spec, registered in `AuthModule` as the fourth
   `APP_GUARD`, after `RolesGuard`.
5. A single resolver service returning the caller's effective set, so the rule lives in one place and
   can later grow a per user override without touching the guard.
6. `GET /users/me/permissions`.
7. **Migrate every route** from `@Roles([...])` to `@RequirePermissions(...)`. Retire the wrapper in
   `src/common/decorators/roles.decorator.ts` that silently unioned in `SYSTEM_ADMIN`/`ADMIN`; that
   union is now explicit in `ROLE_PERMISSIONS`. Keep `@Roles()` only for the SYSTEM_ADMIN identity
   protections in `UsersService`.
8. Keep every project scoped `assertCanX()` check exactly where it is. The guard answers capability;
   the service answers scope.

**Exit criteria.** No route gated by `@Roles()` except the identity rules. `GET /users/me/permissions`
returns a correct set per role, asserted by a spec per role. **Risk: high**, this changes who can reach
what. Phase 3's specs are what make it safe; do not attempt it before them.

### Phase 5: backend module mirror (D1)

Per module, one PR each. Order: `users` and `profiles` first (smallest, proves the pattern), then
`leave`, `audit-log`, `notifications`, then the project domain.

1. Create `dto/<module>.dto.ts` with Response, Query, and Request groups in that order.
2. Create `<module>.swagger.ts` and move every inline `@ApiResponse` into it. This is 305 decorators
   across 27 controllers in total.
3. Add response DTO classes, starting with `ProjectResponseDto` and `ClientProjectResponseDto`, so the
   client projection becomes a typed contract rather than a hand written `select`.
4. Reduce each controller to routing only.
5. Split `ProjectsModule`'s 13 controllers into `ProjectsModule`, `ProjectStaffingModule`,
   `ProjectDocumentsModule`, `TimeTrackingModule`, `WorkReportsModule`, `BlockersModule`, and
   `ReviewsModule`, keeping `ProjectActivityService` reachable by all of them without splitting the
   activity log across DI instances.
6. Break `projects.service.ts` (1,109 lines) along the same seams, keeping `ALLOWED_STATUS_TRANSITIONS`
   and `compareForDashboard` as shared, individually tested units.
7. Move the AI and Slack calls still running in the request path onto BullMQ.

**Exit criteria.** Every module matches the backend module template. No service over 600 lines. No module with
more than four controllers. `/api/docs` shows request and response schemas for every endpoint. The test
suite green throughout.

### Phase 6: the backend serves everything (D4, D5)

The phase that unblocks the frontend work.

1. **Inventory every computation in `pmt-frontend`.** Every `useMemo` that derives, every `.sort(`,
   `.filter(`, `.reduce(`, every label map, every tone map, every permission boolean assembled from a
   role string. That list is this phase's backlog.
2. **Move each one into a response field.** Derived numbers, ordering, grouping, and aggregates become
   columns on the response DTO.
3. **Add display metadata to the response.** A status arrives as
   `{ value: 'READY_FOR_WORK', label: 'Ready for work', tone: 'primary' }` rather than as a bare enum
   the client has to interpret. The tone vocabulary is fixed and small, and the client's only job is
   mapping a tone name to a class.
4. **Add capability flags to every resource.** `canEdit`, `canArchive`, `canApprove`, `canDelete`,
   computed server side from the caller's permissions and the project scope rules. The frontend hides
   what the server says is not permitted, and never re-derives that from a role.
5. **Move sorting, filtering, and grouping to query params** wherever the frontend does it today,
   including the dashboard sort, which currently runs in JS after fetching.
6. **Complete the validation surface (D5).** A custom validator in `src/common/validators/` for every
   rule the built in decorators cannot express, each with a spec. Length bounds on every free text
   field that reaches the database, an email, a Slack message, or an AI prompt.
7. Publish the resulting contract so the frontend can be checked against it: either generate frontend
   types from `/api/docs-json`, or add a CI check that the hand written types still match it.

**Exit criteria.** Every value any screen renders is a field on a response. A second API consumer could
build the same screens without re-deriving anything.

### Phase 7: frontend foundations

Unchanged from the original plan, and now downstream of Phase 6.

1. Add TanStack Query and Table, React Hook Form, Zod, and date-fns.
2. `QueryProvider` with the reference's defaults, mounted in the root layout.
3. Port `lib/api/fetch.ts` and `humane-error.ts`. **Change `window.setTimeout` to `setTimeout`.** Keep
   the existing `ApiError` shape so current call sites still compile.
4. `npx shadcn init` against the existing tokens, then re-add the primitives through the CLI.
5. Expand `globals.css` with the radius ladder, type scale, tracking, and motion tokens. Keep the
   existing colour values.
6. Port `components/data-table/` and `use-table-state.ts`.
7. `contexts/role-context.tsx`, fed from `GET /users/me/permissions` rather than from a role string.
8. Port `proxy.ts` with its comments. Cookie shape only, no network call.

**Exit criteria.** One screen migrated end to end, measurably shorter, with a test.

### Phase 8: frontend module migration

One PR per module, ascending by size: `settings` (92), `reports` (293), `profile` (403), `blockers`
(479 + 493), `users-admin` (527), `projects` (581), `audit-logs` (695), `daily-work-reports` (771),
`leave-requests` (1,823), `project-detail` (3,339).

Per module: extract the types, write the API client on `apiFetch`, write the hook with its key factory,
split into the seven file decomposition, convert forms to React Hook Form and Zod mirroring the DTO
rules, move list state to `useTableState`, **delete every computation the backend now serves**, write
tests for the four view states and the form rules, then run `frontend-code-reviewer` and
`migration-reviewer` before opening the PR.

`project-detail-view.tsx` is a project in itself. Split it by tab with no behaviour change first, then
migrate each tab's data layer separately. Never one PR.

Land the three ESLint rule groups from 5.4 as `warn` at the start of this phase and flip them to
`error` at the end.

**Exit criteria.** No component over 400 lines. No `useEffect` plus `fetch` remaining. No derivation,
sorting, filtering, or aggregation anywhere under `components/`. All three lint groups at `error`.

### Phase 9: documentation and process

1. A real root `README.md`: what it is, how to run it, the port map, the env matrix.
2. Adopt the `openspec/` workflow for anything larger than a single PR.
3. Each package's `CLAUDE.md` updated in the same PR as the change it describes.
4. ADRs for the decisions a future reader would otherwise re-litigate: the permission gate, the
   presentation only frontend, backend owned validation, and the mirror directive itself.

### Sequencing at a glance

```
Phase 0  scaffolding             done
Phase 1  make it verifiable      ← blocks everything
Phase 2  backend foundations       strict · alias + flatten · env · filter · main.ts · schema split
Phase 3  backend test floor      ← blocks Phase 5
Phase 4  permission gate           highest risk change in the plan
Phase 5  backend module mirror     the D1 work
Phase 6  backend serves all        the D4 + D5 work ← blocks Phase 8
Phase 7  frontend foundations
Phase 8  frontend modules          presentation only
Phase 9  documentation             continuous
```

Phases 4 and 5 can overlap once Phase 3 is done, since the permission gate touches decorators and the
mirror touches file layout. Phase 7 can start during Phase 6. Nothing else may be reordered.

---

---

## What Phase 0 already installed

Applied to `pixelvega-tool/` as part of this assessment:

```
docs/                         every repo-wide doc, organized by folder
  architecture/01-assessment.md          the read of both codebases vs the references
  architecture/02-directives.md          the five binding directives
  architecture/03-target-architecture.md the shapes every module lands in
  refactor/01-plan.md                    this document: the nine phases
  refactor/02-checklist.md               185 tickable items, backend first
CLAUDE.md                     repo-wide contract: module shapes, auth rules, testing, style
.gitignore                    was missing entirely at the root
package.json                  root orchestrator (dev, lint, typecheck, test, build, prisma:*)
.lintstagedrc.json            root + one per package
.husky/pre-commit             lint-staged on staged files
.husky/pre-push               prisma generate, lint, typecheck, test, build
.github/workflows/ci.yml      both packages: lint, typecheck, test, build
skills-lock.json              pinned skill versions

.claude/agents/               7 subagents, adapted to PixelVega's domain
  code-reviewer.md              DRY/SOLID/pattern consistency
  frontend-code-reviewer.md     RSC boundary, query wiring, composition, tokens
  security-reviewer.md          the role/session trust boundary, IDOR, injection, uploads
  unit-test-writer.md           Jest (mocked Prisma) + Vitest/RTL templates
  e2e-test-writer.md            supertest against a real DB + Playwright
  performance-reviewer.md       render cost, waterfalls, N+1, bundle
  migration-reviewer.md         conformance against this document (PixelVega-specific, new)

.claude/agent-memory/<agent>/ committed, shared project memory per agent
.claude/skills/               shadcn, next-best-practices, next-cache-components,
.agents/skills/                 vercel-react-best-practices, better-auth-best-practices,
                                better-auth-security-best-practices,
                                email-and-password-best-practices, openspec-*
.claude/commands/opsx/        /opsx:propose, apply, update, sync, archive, explore
```

The agents are adapted, not copied. Each one carries PixelVega's actual invariants: the automatic
ADMIN union in the `Roles` wrapper, the ownership rules that deliberately survive admin, the CLIENT
projection, the one-active-timer rule, the nine-hour cap, and the specific decomposition targets for
this frontend. `seo-reviewer` was dropped (no public search surface) and `migration-reviewer` was
added, since a migration is what this repo is doing.

**Deliberately not copied:** the reference repos' `.claude/settings.local.json` files (machine-local
permission allowlists), their accumulated `agent-memory` notes (about a different product), and the
Stripe, two-factor, and organization skills (no corresponding surface here).

### To activate

```bash
cd "pixelvega-tool"
pnpm install          # installs husky, lint-staged, concurrently, prettier
pnpm exec husky init  # activates the hooks (pre-commit and pre-push are already written)
pnpm install:all      # then install both packages
```

Both hooks are already executable. `husky init` only needs to set `core.hooksPath`.

---

---

## Risks and open questions

### Risks

| Risk                                                                   | Mitigation                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict mode surfaces a large error count in one PR                     | Land it per directory with the flag off until the last PR. Never silence with `any`                                                                                                                 |
| Migrating `project-detail-view.tsx` (3,339 lines)                      | Split by tab first with no behaviour change, then migrate each tab's data layer separately. Never one PR                                                                                            |
| Refactoring untested services                                          | Hard ordering: Phase 3 before Phase 5. Do not reorder this                                                                                                                                          |
| Design-token lint blocks all work if landed as `error`                 | Land as `warn`, clear violations, then flip                                                                                                                                                         |
| Reference repos are siblings on disk, not a dependency                 | Agents cite them by relative path. If the checkouts move, update the paths in `CLAUDE.md` and the agent files                                                                                       |
| **Permission gate (D2) changes who can reach what**                    | The single highest risk item in the plan. It lands only after Phase 3's specs exist, with a per role spec asserting the effective set, and an E2E role visibility matrix. Do not attempt it earlier |
| **The flatten (D1) is a large import churn**                           | Do it in the same sweep as the `@/` alias so the churn is paid once, as a pure move with no logic change, verified by `tsc --noEmit` plus the full suite before and after                           |
| **The schema split (D3) could silently alter the schema**              | Verify with `npx prisma migrate diff` that the split is byte identical. A split that changes the schema is a bug, not a migration                                                                   |
| **Moving computation to the backend (D4) can change displayed values** | Each moved computation ships with a spec asserting it produces what the frontend produced. Where the two disagree, decide which was right before shipping, rather than assuming the backend is      |
| **`forbidNonWhitelisted` (D5) breaks a live client**                   | Audit every frontend call site and Postman collection first, and ship it in the same deploy as the CORS change                                                                                      |

### Open questions

Two earlier open questions are now answered by the directives: the frontend does **not** fetch server
side beyond session and role resolution (D4 makes it a pure presenter, not a second compute layer), and
frontend types **are** derived from the OpenAPI schema or CI checked against it (Phase 6 item 7).

1. **Is `postman/` safe to commit?** It is gitignored today. If the collections carry real
   credentials, keep them out and commit a sanitised export instead. If not, commit them: they are the
   only executable record of the API surface.
2. **What deploys where, and how?** Neither package has a Dockerfile or a deploy workflow. The
   `CORS_ORIGINS` and cookie-domain work in Phase 2 needs the real production origins to be correct.
3. **How granular should `Permission` be?** One value per capability is the rule, but the boundary
   between "edit a project" and "edit a project's estimated hours" is a product call. Draft the enum
   from the existing `@Roles` lists plus the service level `assertCanX` rules, then review it before
   the migration in Phase 4 rather than after.
4. **Coverage floor?** Deliberately unset. Measure after Phase 3 and ratchet from there rather than
   picking a number now.

### Non-goals

This plan does not change the product, the domain rules, or the visual design. No feature is added,
removed, or redesigned, and no screen changes what it means.

It is not, however, purely internal. The directives make four deliberate outward changes, and each is
called out where it lands rather than buried:

| Change                                                                         | Where   | Why it is not a refactor                                                                                     |
| ------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------ |
| `forbidNonWhitelisted` rejects unknown body fields                             | Phase 2 | A request that used to succeed with a field silently dropped now returns 400                                 |
| A `Permission` enum and its table are added to the schema                      | Phase 4 | New enum, new migration. No existing model changes                                                           |
| The schema is split across files                                               | Phase 2 | File layout only. `prisma migrate diff` must show no drift, or it is a bug                                   |
| Response payloads gain computed fields, display metadata, and capability flags | Phase 6 | Additive. Nothing is removed from a response, so an unmigrated frontend keeps working through the transition |

Everything else is a refactor: same behaviour, better structure.
