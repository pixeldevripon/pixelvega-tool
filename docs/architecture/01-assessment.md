# Architecture Assessment

> Part of the PixelVega refactor documentation. Index: [`docs/README.md`](../README.md).

A full read of `pmt-backend` and `pmt-frontend`, measured against the reference codebases
`island-tour-development` and `tripwheel-x-islandtours-dashboard`.

Written 2026-08-19. The decisions taken from it are in
[`02-directives.md`](./02-directives.md); the work is in
[`../refactor/01-plan.md`](../refactor/01-plan.md).

---

## 0. Executive summary

PixelVega PMT is a genuinely well-designed product with a well-documented domain. `pmt-backend`'s
own `CLAUDE.md` is one of the better pieces of engineering documentation in any of these four repos:
it captures non-obvious wiring, business invariants, and the reasoning behind them. The domain model
is careful (append-only staffing history, an explicit status state machine, derived-not-stored hours,
soft deletes, an audit log).

What it lacks is the **engineering scaffolding** that the reference repos have: verification, type
safety, boundaries, and composition discipline. Concretely:

|                         | pmt-backend            | island backend        | pmt-frontend               | dashboard reference |
| ----------------------- | ---------------------- | --------------------- | -------------------------- | ------------------- |
| Source files            | 165 ts                 | 534 ts                | ~110 ts/tsx                | 684 ts/tsx          |
| Lines of code           | 15,446                 | 168,163               | 18,441                     | ~85,000             |
| **Unit test files**     | **0**                  | **143**               | **0**                      | **31**              |
| **E2E test files**      | **0 (1 stale stub)**   | yes                   | **0**                      | **13**              |
| TypeScript `strict`     | **off**                | on                    | on                         | on                  |
| Path alias `@/`         | **no**                 | yes                   | yes                        | yes                 |
| Global exception filter | **no**                 | yes                   | n/a                        | n/a                 |
| Env validation at boot  | **no**                 | yes (283 lines)       | no                         | no                  |
| Data-fetching library   | n/a                    | n/a                   | **none (raw `useEffect`)** | TanStack Query      |
| Form library            | n/a                    | n/a                   | **none (hand-rolled)**     | RHF + Zod           |
| CI runs                 | **nothing** (see note) | lint, build, test     | **nothing**                | nothing (known gap) |
| Git hooks               | **none**               | pre-commit + pre-push | **none**                   | lint-staged         |

The five findings that matter most, in order:

1. **There are zero tests in either package.** 34 database migrations of accumulated business logic
   (a status state machine, workload rules, a nine-hour timer cap, leave balance arithmetic) with no
   automated proof that any of it still works. This is the single largest risk and the first thing
   the plan addresses.
2. **`pmt-backend` is not in TypeScript strict mode.** `"strict": true` is absent, `noImplicitAny` is
   explicitly `false`, and `strictBindCallApply` and `noFallthroughCasesInSwitch` are turned off. The
   type system is not doing the work the reference repos rely on it for.
3. **`pmt-frontend` has no data layer.** 372 `useState` and 71 `useEffect` calls across roughly 40
   client components, each re-implementing fetch, loading, error, and race-guard handling by hand.
   `project-detail-view.tsx` alone is 3,339 lines. The dashboard reference solved this exact problem
   with TanStack Query plus a shared component decomposition, and that is the pattern to adopt.
4. **No quality gate exists anywhere.** No pre-commit hook, no pre-push hook, and CI runs `pnpm build`
   on the backend only. Nothing stops a lint error, a type error, or a broken frontend from landing.
5. **`CLAUDE.md`, `docs/`, and `postman/` are gitignored in `pmt-backend`.** The best documentation in
   the project is invisible to a fresh clone, to CI, and to every teammate. Per-machine copies drift
   silently.

None of this requires a rewrite. The domain logic is sound. The work is adding the scaffolding around
it and moving code into shapes the scaffolding can hold, in a sequence where each phase is
independently shippable.

---

---

## 1. What was scanned

| Repo                   | Path                                                 | Role in this document                                                                                                         |
| ---------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| PixelVega backend      | `pixelvega-tool/pmt-backend`                         | subject                                                                                                                       |
| PixelVega frontend     | `pixelvega-tool/pmt-frontend`                        | subject                                                                                                                       |
| Island Tours           | `island-tour-development` (`backend/` + `frontend/`) | backend reference, and the source of the agent/skill tooling                                                                  |
| Island Tours dashboard | `tripwheel-x-islandtours-dashboard`                  | frontend reference (the closest analogue to `pmt-frontend`: an admin CRM with no database, talking to a NestJS API over HTTP) |

The dashboard is the more relevant frontend reference of the two. It is the same kind of application
as `pmt-frontend`: a role-gated internal admin UI that owns no data and calls a NestJS API with a
better-auth session cookie.

---

---

## 2. Side-by-side architecture comparison

### 2.1 Workspace topology

**PixelVega today.** Two sibling directories under one git repo. No root `package.json`, no root
`.gitignore`, no shared scripts. Each package is installed and run separately.

**Island Tours.** A root `package.json` orchestrates both packages with `concurrently`, exposes
`dev`, `build`, `lint`, `test:*`, and every `prisma:*` command from the root, and installs husky via
`prepare`. One command boots the whole stack.

The reference topology is strictly better for a two-package product and costs almost nothing to
adopt. This is Phase 0 and is already applied here.

### 2.2 Backend

#### Stack

The two backends are on **the same stack**, which is why the migration is a refactor and not a
rewrite: NestJS 11, Prisma 7 with `@prisma/adapter-pg` driver adapters, PostgreSQL, better-auth,
`@nestjs/swagger`, `class-validator` + `class-transformer`, `@nestjs/throttler`, BullMQ, Cloudinary,
pnpm. PixelVega adds the Anthropic SDK and Slack Web API; Island adds Stripe, Mollie, and Resend.

Every architectural difference below is therefore about **how the stack is used**, not about which
stack to use.

#### Bootstrap (`main.ts`)

| Concern          | pmt-backend                                                         | island backend                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Env validation   | none                                                                | `validateEnv()` as the first statement, 283 lines of per-variable rules including placeholder detection and minimum secret lengths                                                           |
| Security headers | `helmet` is in `dependencies` but **never called**                  | `helmet()` with an explicit CSP, tightened in production                                                                                                                                     |
| Proxy trust      | not set                                                             | `trust proxy` = 1 so the throttler reads the real client IP                                                                                                                                  |
| CORS             | `origin: process.env.CORS_ORIGIN \|\| '*'` with `credentials: true` | an allowlist callback that rejects unknown origins with a `ForbiddenException`, explicitly refuses the literal `'null'` origin, pins `allowedHeaders`, and sets `maxAge` to cache preflights |
| Validation pipe  | `whitelist: true, transform: true`                                  | `whitelist: true, forbidNonWhitelisted: true, transform: true`                                                                                                                               |
| Exception filter | none                                                                | `AllExceptionsFilter` mapping Prisma `P2002`/`P2003`/`P2025`/`P2014` to readable 409/404 responses, with a stable response envelope                                                          |
| Shutdown         | none                                                                | `enableShutdownHooks()`                                                                                                                                                                      |

Three of these are latent production problems rather than style differences:

- **`CORS_ORIGIN` falling back to `*` while `credentials: true` is set.** Browsers refuse that
  combination, so the practical effect is that a missing env var breaks every authenticated call in a
  confusing way instead of failing loudly at boot.
- **No `forbidNonWhitelisted`.** A request body field that does not exist on the DTO is silently
  dropped rather than rejected. A typo in a client payload fails quiet: the request succeeds and the
  value is simply not applied.
- **No global exception filter.** An unmapped Prisma error surfaces as a bare `500 Internal server
error`, which is both a bad user experience and a diagnostic dead end. The reference turns the four
  common Prisma constraint codes into sentences a user can act on.

#### Type safety

`pmt-backend/tsconfig.json` omits `"strict": true` and explicitly disables three checks:

```jsonc
"strictNullChecks": true,        // the only strict flag that is on
"noImplicitAny": false,          // off
"strictBindCallApply": false,    // off
"noFallthroughCasesInSwitch": false
```

The island backend sets `"strict": true` plus `noFallthroughCasesInSwitch` and adds a `@/*` path
alias. Both run the same `typescript-eslint` `recommendedTypeChecked` config, so the linters are
comparable; the compilers are not.

The absence of the path alias is visible in the import graph: `pmt-backend` has **67 imports at
`../../../` depth and 9 at `../../../../`**. Every file move breaks a batch of them, which is a real
tax on exactly the kind of restructuring this plan asks for. Adding the alias is a prerequisite for
the rest, not a cosmetic step.

#### Module anatomy

Both use `feature/{controller,service,module,dto}`. The reference adds two things:

**A `<module>.swagger.ts` file.** Documentation decorators are composed with `applyDecorators()` and
imported into the controller by name:

```ts
// categories.swagger.ts (reference)
const adminErrors = [
  ...commonErrors,
  ApiResponse({ status: 403, type: ForbiddenErrorDto }),
];

export const ApiCreateCategoryDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Create a category" }),
    ApiResponse({ status: 201, type: CategoryDetailResponseDto }),
    ...adminErrors,
  );
```

```ts
// categories.controller.ts (reference)
@ApiCreateCategoryDocs()
@RequirePermissions(Permission.CREATE_CATEGORY)
@Post()
create(@Body() dto: CreateCategoryDto) {
  return this.service.create(dto);
}
```

`pmt-backend` has **305 `@ApiResponse` decorators inline across 27 controllers**. The controllers are
readable in spite of that, not because of it: `projects.controller.ts` is 342 lines for 15 routes,
and most of that is documentation. Moving the decorators out is a mechanical change that roughly
halves controller size and, more importantly, lets error-response sets be shared instead of retyped.

**Response DTO classes.** The reference declares `CategoryResponseDto`, `CategoryDetailResponseDto`,
and so on, with `@ApiProperty({ example })` on every field. `pmt-backend` declares request DTOs only
and returns Prisma result objects directly. Two consequences: the generated OpenAPI has no response
schemas (so `/api/docs` cannot tell a consumer what comes back), and there is no compile-time
statement of what a given endpoint is allowed to expose. The CLIENT-projection rule (a client must
never see priority, rush reason, hold reason, cancellation reason, or staffing) is currently enforced
only by a hand-written `select` object inside the service, with nothing checking it.

#### Authorization

Both are role-based on top of better-auth with a global auth guard and per-route decorators.

PixelVega's `Roles` wrapper is a genuinely good idea: it unions `SYSTEM_ADMIN` and `ADMIN` into every
role list so no route has to repeat them. It is also the codebase's biggest authorization footgun,
because `@Roles([Role.DEVELOPER])` does not mean what it reads like. That is documented in
`CLAUDE.md` and should stay documented; the `security-reviewer` agent added in Phase 0 is instructed
to question it on every route.

The reference goes one step further with a **permission layer** (`@RequirePermissions(...)`,
`@RequireAnyPermission(...)`) resolved by a `PermissionsGuard` against an effective-permission set,
plus a documented guard order (`ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard`).

**Recommendation: do not port the permission layer.** PixelVega has six fixed roles and no per-user
grant model. A permission enum would be pure indirection over a role check. What is worth porting is
the smaller half: an explicit `@Public()`/`@AllowAnonymous()` convention, the documented guard order,
and moving scattered in-service scope checks into named `assertCanX()` helpers so they are findable
and testable. This is the one place where the plan deliberately does not follow the reference, and
the reason is that PixelVega's authorization model is genuinely simpler.

#### Prisma layout

|            | pmt-backend                                                                                                                   | island backend                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Schema     | one `schema.prisma`, 1,049 lines                                                                                              | ~35 domain files (`tours.prisma`, `bookings.prisma`, `enums.prisma`, ...) merged by Prisma 7 |
| Migrations | 34                                                                                                                            | many, with a documented re-baseline procedure                                                |
| Seed       | one `seed.ts` plus `prisma/seed/`, deterministic from a seeded RNG, real password hashes, reproduces service-layer invariants | several targeted seeds                                                                       |

PixelVega's **seed is excellent** and better than the reference in one respect: it recomputes derived
values (`actualHours` from time entries, approved requirements folded into estimates) the same way
the service does, so the seeded database is internally consistent rather than merely populated. Keep
it exactly as it is.

The single-file schema is fine at 1,049 lines and starts to hurt past roughly 1,500. Splitting is
cheap (Prisma 7 merges a folder automatically) and is scheduled late in the plan, not early, because
it buys readability rather than correctness.

#### Service size

| File                              | Lines |
| --------------------------------- | ----- |
| `projects.service.ts`             | 1,109 |
| `daily-work-report.service.ts`    | 927   |
| `project-time-entries.service.ts` | 663   |
| `blocker.service.ts`              | 604   |
| `project-members.service.ts`      | 521   |

`ProjectsModule` registers **13 controllers**. The module is really eight features (projects,
staffing, documents, time tracking, requirements, reports, blockers, reviews, feedback) sharing one
module declaration. The reference splits at this boundary. Splitting is worthwhile but it is
**not urgent**, and it must come after tests: refactoring a 1,109-line service with no test coverage
is how a working system stops working.

### 2.3 Frontend

This is where the two codebases differ most, and where the migration has the highest payoff.

#### Stack

| Concern          | pmt-frontend                                                       | dashboard reference                                          |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Framework        | Next 16.2.10, React 19.2.4                                         | Next 16.2.4, React 19.2.4                                    |
| Server state     | **none**                                                           | `@tanstack/react-query` v5                                   |
| Tables           | hand-written `<table>` markup                                      | `@tanstack/react-table` + a shared `components/data-table/`  |
| Forms            | hand-rolled `useState` per field                                   | `react-hook-form` + `zod` + `@hookform/resolvers`            |
| UI kit           | 3 Radix packages, hand-copied primitives, **no `components.json`** | `shadcn` CLI + full `radix-ui`, real `components.json`       |
| Client state     | a hand-written `useSyncExternalStore` store                        | `zustand` where needed, React context for role               |
| Dates            | `Intl.DateTimeFormat` inline in each component                     | `date-fns`                                                   |
| Charts / editors | none                                                               | `recharts`, `tiptap`, `codemirror`                           |
| Tests            | **none**                                                           | `vitest` + `happy-dom` + Testing Library, `playwright`       |
| Route guard      | **none**                                                           | `proxy.ts` (Next 16's renamed middleware)                    |
| Lint             | stock `eslint-config-next`                                         | stock plus design-token and dependency-direction enforcement |

#### The data layer

`pmt-frontend/lib/api/client.ts` is a competent hand-written client. It handles JSON and FormData,
sets `credentials: 'include'`, applies a 15-second timeout via `AbortController`, normalises error
messages, and exposes a typed `ApiError`. It has one hard limitation:

```ts
const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
```

`window` makes `apiRequest` **browser-only**. Every call site must therefore be a Client Component,
which is a structural reason (not just a habit) that this app has no server-side data fetching at all.
Changing `window.setTimeout` to `setTimeout` is a one-line fix and it unblocks the entire RSC story.

The reference's `lib/api/fetch.ts` adds, on top of the same shape:

- **Retry with jittered backoff on 429 and 503, for idempotent GETs only.** A dashboard page mounts
  many parallel queries at once; without this a burst that briefly trips the API throttle surfaces to
  the user instead of self-healing. Jitter matters: without it, N parallel retries collide again on
  the same throttle window.
- **`humane-error.ts`,** a pure module (no fetch, no React) that is the single place a technical
  failure becomes a sentence. Its documented contract is that whatever it returns is safe to toast
  verbatim. Backend 4xx business copy passes through unchanged; framework noise ("Internal server
  error", "Failed to fetch", "Unexpected token '<'", a 20-line validation dump) never reaches a user.
  Validation output is capped at three lines.
- **`buildQuery`,** one isomorphic query-string builder instead of a per-module copy.

#### The component layer: the core problem

`pmt-frontend` composes by page. One page equals one large client component that owns everything.

```
components/dashboard/project-detail-view.tsx     3,339 lines
components/dashboard/leave-requests-view.tsx     1,823 lines
components/dashboard/daily-work-reports-view.tsx   771 lines
components/dashboard/audit-logs-view.tsx           695 lines
components/dashboard/projects-view.tsx             581 lines
```

Across the app: **372 `useState`, 71 `useEffect`, 40 `"use client"` directives**. The pages themselves
are correctly Server Components (a real strength worth keeping), but each one immediately hands off
to a client component that does all the work, so the RSC boundary buys nothing today.

`projects-view.tsx` is the representative case. In one file it owns: seven pieces of filter state, a
`latestRequestRef` counter to guard against out-of-order responses, a manual debounce, loading and
error state, a subscription to the global user store, role-derived permission booleans, the filter
panel, the table markup, the empty state, and pagination. Every list screen in the app repeats that
same machinery with small variations.

The reference decomposes by module instead:

```
app/(app)/categories/page.tsx                 Server Component: title + <CategoriesListView/>
components/categories/categories-list-view.tsx   55 lines: useTableState + useCategories + render
components/categories/categories-table.tsx       presentational
components/categories/category-columns.tsx       column definitions
components/categories/category-row-actions.tsx   dropdown
components/categories/category-form.tsx          RHF + Zod
components/categories/category-delete-dialog.tsx confirmation
components/categories/category-quick-edit-sheet.tsx
```

`categories-list-view.tsx` is 55 lines because the three hard parts live in shared code:
`useTableState` (URL-synced page, limit, debounced search, and named filters, written once),
`useCategories` (a TanStack Query hook), and `components/data-table/` (toolbar, pagination, empty
state, skeleton, bulk bar).

`useTableState` is worth calling out specifically. It puts list state in the URL, so reload, the back
button, and a shared link all restore the exact view, and it writes with the History API rather than
`router.replace` to avoid an RSC round trip on every keystroke. That single hook replaces the
hand-rolled state machine in every one of PixelVega's list views.

#### Design system

`pmt-frontend/app/globals.css` is 85 lines: a reasonable semantic token set (`--background`,
`--card`, `--primary`, `--success`, `--warning`, `--danger`) mapped into Tailwind v4 via
`@theme inline`, with a `.dark` block. The foundation is right.

The reference's is 929 lines and adds a radius ladder, a type scale with per-step line heights,
tracking, motion tokens (with a documented Tailwind v4 gotcha: `duration-*` resolves against
`--transition-duration-*`, not `--duration-*`), and full neutral and brand ramps.

More important than the token count is that the reference **enforces** them in `eslint.config.mjs`:

- no numeric Tailwind palette class (`bg-blue-500`), variants included
- no raw `#hex` / `rgb()` / `hsl()` / `oklch()` literal in a component
- no inline `style` attribute (with a narrow allowlist for TanStack Table column widths, which has no
  class-based equivalent)
- no arbitrary `text-[...]`
- spacing restricted to a fixed scale
- icon-only buttons must carry a label

Plus `import/no-restricted-paths` zones for dependency direction: `lib/` never imports `components/`,
`types/` imports only `types/`, one component module never imports another module, one hook domain
never imports another hook domain.

This is the highest-leverage single file in the reference repos. It converts a written convention
into a build failure, which is the only form of convention that survives contact with a deadline.

#### Route protection

`pmt-frontend` has no `middleware.ts` and no `proxy.ts`. Auth is entirely client-side: the layout
mounts, `userStore.loadCurrentUser()` fires, and an unauthenticated user is redirected after the
dashboard shell has already rendered.

The reference's `proxy.ts` checks that the session cookie is **present and well-formed** and nothing
more. That property is load-bearing and heavily commented: an earlier version called
`/api/auth/get-session` from the proxy, which runs on every navigation _and_ every `<Link>` prefetch,
and that request storm exhausted the API's per-IP throttle. A throttled 429 then read as "no session"
and bounced logged-in users to the login page. It also detects a malformed-but-present cookie and
strips it on the redirect, so a tampered value produces a clean re-login instead of a loop.

Port the pattern **and** the comment. The comment is the part that stops someone from re-adding the
network call.

### 2.4 Quality gates

| Gate         | pmt-backend       | pmt-frontend | island                                                                                  | dashboard                    |
| ------------ | ----------------- | ------------ | --------------------------------------------------------------------------------------- | ---------------------------- |
| pre-commit   | none              | none         | `lint-staged` (eslint --fix on staged files)                                            | `.lintstagedrc.json` present |
| pre-push     | none              | none         | prisma generate, lint, test, build backend, boot backend, build frontend, boot frontend | none                         |
| CI lint      | no                | no           | yes                                                                                     | no                           |
| CI typecheck | no                | no           | via build                                                                               | no                           |
| CI test      | no                | no           | yes                                                                                     | no                           |
| CI build     | **no** (see note) | **no**       | yes                                                                                     | no                           |

**Correction, found while executing phase 1 (2026-08-19).** This assessment originally reported that
`pmt-backend/.github/workflows/ci.yml` runs install, `prisma generate`, and `pnpm build`. It does not
run at all. GitHub Actions reads workflows only from `.github/workflows/` at the **repository root**,
and the repository root is `pixelvega-tool/`. That file is a leftover from when `pmt-backend` was its
own repository, and it has never executed since the merge. `pmt-frontend` has no workflow either.

So the real position is worse than first reported: **this repo has had no CI whatsoever.** Nothing has
verified either package before a merge. The orphaned file was deleted in phase 1 and replaced by the
root workflow, which covers both packages.

The island pre-push hook is unusually thorough because that project's frontend build fetches from a
live backend during `next build`, so it boots the whole stack in order and tears down only what it
started. PixelVega does not need that sequencing (the frontend build has no backend dependency), so
its pre-push hook can stop at lint, typecheck, test, and build. That is what Phase 0 installed.

### 2.5 Agent and AI tooling

This is the largest gap of all, and the cheapest to close.

|                | island-tour-development                                                          | pmt-backend / pmt-frontend (before)                              |
| -------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `CLAUDE.md`    | 28KB root, committed, plus per-package                                           | 281 lines in backend, **gitignored**; frontend's is 1 empty line |
| Subagents      | 8 in `.claude/agents/`                                                           | none                                                             |
| Agent memory   | `.claude/agent-memory/`, ~30 accumulated review notes, committed                 | none                                                             |
| Skills         | 14 vendored, pinned in `skills-lock.json`, mirrored to `.claude/` and `.agents/` | none                                                             |
| Slash commands | `/opsx:*` spec-driven workflow                                                   | none                                                             |
| Spec workflow  | `openspec/` with changes and archive                                             | none                                                             |
| Codex parity   | `.codex/agents/*.toml` + skills                                                  | none                                                             |

`pmt-backend/.claude/` contains only a `settings.local.json` whose allowlist still references a
previous machine's paths (`/Users/pixelvega/jabed/pmt-backend`), so it is stale as well as
uncommitted.

The gitignore decision is worth restating plainly, because it undoes most of the value of the work
already done: `pmt-backend/.gitignore` excludes `CLAUDE.md`, `docs/`, `postman/`, and
`pixelvega-build-spec.md`. The best documentation in the project does not exist in a fresh clone.

---

---

## 3. Gap register

Severity is about **risk to the running product**, not about effort.

### Critical

| #   | Gap                                         | Consequence                                                                                                                        | Phase |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- |
| C1  | Zero tests, both packages                   | No proof the status machine, workload rules, timer cap, or leave arithmetic still work. Blocks safe refactoring of everything else | 1, 5  |
| C2  | No pre-commit, no pre-push, no frontend CI  | Lint errors, type errors, and broken builds can merge                                                                              | 1     |
| C3  | `pmt-backend` not in TypeScript strict mode | `noImplicitAny: false` means untyped values flow silently through business logic                                                   | 2     |
| C4  | No global exception filter                  | Prisma constraint violations reach the client as bare 500s                                                                         | 2     |
| C5  | No env validation at boot                   | A missing or placeholder secret fails at first use, in production, not at startup                                                  | 2     |

### High

| #   | Gap                                                               | Consequence                                                                                               | Phase |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| H1  | Frontend has no data-fetching library                             | 372 `useState` / 71 `useEffect`; every list re-implements loading, error, debounce, and race guarding     | 4     |
| H2  | Components up to 3,339 lines                                      | Untestable, unreviewable, and merge-conflict prone                                                        | 4     |
| H3  | `apiRequest` uses `window.setTimeout`                             | Structurally forces every call site into a Client Component                                               | 3     |
| H4  | No `@/` path alias in the backend                                 | 76 imports at three or four levels deep; every file move breaks a batch                                   | 2     |
| H5  | `CORS_ORIGIN` falls back to `*` with `credentials: true`          | A missing env var breaks all authenticated calls in a confusing way                                       | 2     |
| H6  | No `forbidNonWhitelisted`                                         | A mistyped request field is silently ignored rather than rejected                                         | 2     |
| H7  | `CLAUDE.md` and `docs/` gitignored                                | Team context invisible to a fresh clone; per-machine copies drift                                         | 1     |
| H8  | `.env.example` says `NEXT_PUBLIC_API_URL="http://localhost:3001"` | 3001 is the frontend's own port. A fresh clone points the app at itself. `.env.local` correctly says 3000 | 1     |
| H9  | No route guard on the frontend                                    | The dashboard shell renders before the auth check resolves                                                | 3     |
| H10 | `helmet` installed but never called                               | No security headers in production                                                                         | 2     |

### Medium

| #   | Gap                                                               | Consequence                                                              | Phase    |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ | -------- |
| M1  | Swagger decorators inline (305 across 27 controllers)             | Controllers dominated by documentation; error sets retyped per route     | 6        |
| M2  | No response DTOs                                                  | OpenAPI has no response schemas; the CLIENT projection rule is unchecked | 6        |
| M3  | No `components.json`                                              | shadcn CLI unusable; every primitive is hand-maintained                  | 3        |
| M4  | No design-token or dependency-direction lint                      | Conventions are advisory and drift                                       | 4        |
| M5  | No form library                                                   | Validation logic duplicated per form and diverges from backend DTO rules | 4        |
| M6  | Frontend types hand-mirror backend DTOs                           | Silent drift when a backend enum changes                                 | 6        |
| M7  | `ProjectsModule` holds 13 controllers; services up to 1,109 lines | Hard to navigate and to test                                             | 7        |
| M8  | Single 1,049-line `schema.prisma`                                 | Readability only. Not urgent                                             | 7        |
| M9  | `test/app.e2e-spec.ts` is stale starter boilerplate               | Expects a `GET /` that no longer exists; fails if run                    | 1        |
| M10 | No root workspace orchestration                                   | Every command runs from two directories                                  | 0 (done) |

### Low

| #   | Gap                                                                 | Phase |
| --- | ------------------------------------------------------------------- | ----- |
| L1  | No `.prettierrc` in `pmt-frontend` (backend has one)                | 2     |
| L2  | `.claude/settings.local.json` references a previous machine's paths | 1     |
| L3  | Root `README.md` is two lines                                       | 8     |
| L4  | No `CHANGELOG.md` or ADR trail                                      | 8     |
| L5  | Frontend `AGENTS.md` holds only the injected Next.js banner         | 1     |

### Adopted after review

The first draft of this document recommended against porting the reference's permission layer, on the
grounds that six fixed roles do not need one. **That recommendation is withdrawn.** The decision is to
adopt it, along with four further directives recorded in [`02-directives.md`](./02-directives.md).
Where this document and those directives disagree, the directives win.

| Reference pattern                             | Earlier call          | Decision                            |
| --------------------------------------------- | --------------------- | ----------------------------------- |
| Permission enum RBAC (`@RequirePermissions`)  | do not port           | **Port it.** See directive D2       |
| Split `prisma/*.prisma` schema files          | Phase 7, low priority | **Port it early.** See directive D3 |
| `src/<module>/` layout, no `modules/` wrapper | not raised            | **Mirror it.** See directive D1     |

Still not adopted, for the reasons already given: the `seo-reviewer` agent (no public search surface),
the Stripe and payments skills (no payment surface), the multi-locale content pipeline (English only),
and island's full stack pre-push hook (this frontend build needs no live backend).

---
