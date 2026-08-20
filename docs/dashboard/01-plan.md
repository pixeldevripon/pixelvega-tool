# Dashboard v1: implementation plan

Twelve phases that take `pmt-frontend` from a partial hand-rolled dashboard to every requirement in
[`00-requirements.md`](./00-requirements.md), built on the shell and design system copied from
`tripwheel-x-islandtours-dashboard`.

Progress is tracked in [`02-checklist.md`](./02-checklist.md). **Tick it in the same PR as the work.**

---

## Where this sits against the refactor plan

[`docs/refactor/01-plan.md`](../refactor/01-plan.md) has nine phases. Phases 0 to 7 are done. Its
Phase 8 is "frontend module migration", one PR per module.

**This plan absorbs and replaces refactor Phase 8.** The two describe the same frontend files, and
running them separately would migrate a screen and then immediately rebuild it. The module by module
discipline that Phase 8 specifies is kept in full: it becomes the per-module recipe in
[The module recipe](#the-module-recipe) below, applied inside every phase here. Refactor Phase 9,
documentation and process, still runs as written.

Refactor Phase 8's exit criteria carry over unchanged and are this plan's exit criteria too:

> No component over 400 lines. No `useEffect` plus `fetch` remaining. No derivation, sorting,
> filtering or aggregation anywhere under `components/`. All three lint groups at `error`.

---

## The governing rule

> **Design, data fetching, animation and rendering strategy come from the reference. Features and
> pages come from the four product documents.**

`pmt-frontend` **is** `tripwheel-x-islandtours-dashboard`, copied whole. Nothing about how this app
fetches, renders, animates or looks is decided again here. Where a question is "how should this
screen get its data" or "how should this list behave", the answer is whatever the reference already
does, and the nearest reference module is the worked example to copy.

What is decided here is only **what the screens are**, and that comes from
[`00-requirements.md`](./00-requirements.md).

The practical consequence: **no pattern in this codebase is up for redesign.** A component that
diverges from the reference's shape is a defect, not a variation, even when the divergence looks like
an improvement. If the reference's pattern is genuinely wrong for something, say so and get a
decision, rather than quietly writing a second pattern.

## The two starting facts

**The backend is nearly done.** 144 of 178 requirements are already served, verified against the 29
controllers and their DTOs. Phase 6 of the refactor already made every enum a `{ value, label, tone }`
object, put `capabilities` on every resource, and moved every derived number into a response field. So
the frontend has almost nothing to compute, which is exactly what D4 asks for.

**The reference is a finished dashboard, so it is the starting point rather than a source of parts.**
It has the shell this product wants: a collapsible sidebar with permission-filtered navigation grouped
by task frequency, a command palette, a full semantic token system with real light and dark ramps, 33
shadcn primitives, `data-table` paging against a server, a contrast gate, and Playwright per role.
The old `pmt-frontend` had a hand-rolled 359 line shell and about a fifth of that surface. Replacing
it wholesale is both faster and better than growing it.

---

## The copy is done

Phase D0's first half is already executed, on branch `feat/dashboard-mirror-tripwheel`:

| Step                                                                          | State |
| ----------------------------------------------------------------------------- | ----- |
| The old `pmt-frontend` deleted. Recoverable from `735de54`, which was clean   | done  |
| `tripwheel-x-islandtours-dashboard` copied to `pmt-frontend/` with `rsync -a` | done  |
| `package.json` renamed to `pmt-frontend`, dev and start on port 3000          | done  |
| PMT's `CLAUDE.md`, `.env.example` and `.env.local` restored over the copy's   | done  |
| Displaced PMT files quarantined in `reference-notes/`, with a README          | done  |
| `reference-notes/` excluded from `tsconfig.json` and `vitest.config.ts`       | done  |
| `pnpm install`                                                                | done  |

Verified on the verbatim copy, before any pruning:

| Gate        | Result                                                            |
| ----------- | ----------------------------------------------------------------- |
| `typecheck` | 0 errors                                                          |
| `test`      | 31 files, 227 tests, all passing                                  |
| `build`     | succeeds, with partial prerendering across the route tree         |
| `lint`      | 16 errors and 48 warnings, all inherited from the reference as-is |

The 16 lint errors are the reference's own and are not new: they are pruned or fixed as their files
are either deleted or converted in D0's second half.

### What was deliberately not copied

| Excluded                                                                | Why                                                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `.git/`                                                                 | Another repo's history                                                                                          |
| `node_modules/`, `.next/`, `tsconfig.tsbuildinfo`                       | Rebuilt locally                                                                                                 |
| `.env.local`                                                            | **Holds real secrets for another product.** `INTERNAL_API_SECRET`, a revalidation secret and a live backend URL |
| `dashboard-extraction/`                                                 | 508K of another product's planning specs. Read in place: the path is in `reference-notes/README.md`             |
| `public/videos/`                                                        | 93MB of tour marketing video                                                                                    |
| `e2e/playwright-report/`, `e2e/__shots/`, `e2e/test-results/`           | Generated artifacts                                                                                             |
| `.conductor/`, `.claude/settings.local.json`, `undefined/`, `.DS_Store` | Another machine's tooling state and junk                                                                        |

Everything else came across, including `pnpm-lock.yaml`, so the dependency versions are the
reference's exactly.

---

## What to prune, and what to keep

D0's second half. The rule is narrow: **delete the reference's domain, keep everything else.**

### Delete: the reference's domain

Twenty-two entity domains that have no counterpart in this product. Each is a `components/<domain>/`
folder plus its `hooks/<domain>/`, `lib/api/<domain>.ts`, `types/<domain>.ts` and
`app/(app)/<domain>/` route:

`attributes` · `availability` · `bookings` · `calendar` · `cancellation-requests` · `categories` ·
`collections` · `customers` · `destinations` · `email-centre` · `homepage` · `hubs` ·
`locals-favourites` · `media` · `pages` · `payments` · `recommendations` · `reviews` · `settlements` ·
`spotlight` · `submissions` · `translations` · `trips` · `operators`

Plus the domain libraries under `lib/`: `analytics`, `bookings`, `email-centre`, `emails`,
`home-page`, `media`, `operators`, `recommendations`, `settings`, `tours`, `trips`, and
`lib/cache-tags.ts`, `lib/public-site.ts`, `lib/island-time.ts`, `lib/translatable-schema.ts`.

Delete the dependencies only those domains used: `leaflet`, `react-leaflet`, `@types/leaflet`,
`react-easy-crop`, `@codemirror/lang-html`, `@uiw/react-codemirror`, `@uiw/codemirror-theme-github`,
`@tiptap/*`, `input-otp` if nothing needs an OTP field.

### Keep: everything that is not a domain

| Keep                                                                                                                                              | Why                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/shell/*`                                                                                                                              | The chrome. Sidebar, header, palette, mode toggle, nav prefetch                                                                                                                                                                                          |
| `components/ui/*`                                                                                                                                 | All 33 primitives, untouched                                                                                                                                                                                                                             |
| `components/data-table/*`                                                                                                                         | The server-paging table and `useTableState`                                                                                                                                                                                                              |
| `components/skeletons/*`                                                                                                                          | List, detail, dashboard and profile skeletons                                                                                                                                                                                                            |
| `components/common/*` minus the domain files                                                                                                      | `entity-detail-shell`, `entity-tabs`, `status-badge`, `collapsible-card`, `detail-sheet`, `quick-edit-sheet`, `force-delete-dialog`, `deactivate-dialog`, `save-error`, `notification-bell`, `icon-tile`, `media-upload-zone`, `content-section-manager` |
| `components/statistics.tsx`, `page-components.tsx`                                                                                                | The dashboard's visual vocabulary. Rewritten for PMT figures in D3, and **the shape is not redesigned**                                                                                                                                                  |
| `components/providers/query-provider.tsx`                                                                                                         | The TanStack Query setup, exactly as configured                                                                                                                                                                                                          |
| `components/onboarding/*`, `components/login/*`, `components/profile/*`, `components/staff/*`                                                     | Auth, onboarding and profile surfaces, which PMT needs too                                                                                                                                                                                               |
| `navigations/`, `lib/rbac-utils.ts`                                                                                                               | The permission-filtered nav. Entries rewritten for PMT routes                                                                                                                                                                                            |
| `lib/api/fetch.ts`, `query.ts`, `humane-error.ts`                                                                                                 | **The data fetching contract. This is the pattern being mirrored**                                                                                                                                                                                       |
| `lib/stores/`, `lib/async/`, `lib/motion.ts`, `lib/utils.ts`, `lib/constants/`, `lib/validations/`, `lib/server/`, `lib/currency/`, `lib/config/` | Infrastructure                                                                                                                                                                                                                                           |
| `hooks/use-mobile.ts`, `use-drag-scroll.ts`, `use-sync-form-when-pristine.ts`, `use-unsaved-guard.ts`, `use-visible-section.ts`                   | Shared hooks                                                                                                                                                                                                                                             |
| `contexts/role-context.tsx`                                                                                                                       | Kept, then pointed at PMT's `GET /users/me/permissions`                                                                                                                                                                                                  |
| `e2e/` harness, `playwright.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `scripts/contrast-gate.mjs`                                      | The whole verification apparatus                                                                                                                                                                                                                         |
| `zustand`, `@hugeicons/*`, `framer-motion`, `recharts`, `date-fns`, `react-day-picker`, `cmdk`                                                    | **All kept, because the reference uses them.** User decision, on the record                                                                                                                                                                              |

### Fold PMT's own contract back in

Six files in `reference-notes/` carry work that is ahead of the reference because it was written
against this API. Fold each into the kept file rather than dropping either:

| From `reference-notes/`         | Into                        | What it carries                                                                                                                                                                                                                                     |
| ------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib-pmt/api/fetch.ts`          | `lib/api/fetch.ts`          | Two fixed defects: a caller-supplied abort signal silently disabling the 15 second timeout, and `JSON.parse` throwing a `SyntaxError` out of the client on a non-JSON error body. Check whether the reference's client has either, and keep the fix |
| `lib-pmt/api/humane-error.ts`   | `lib/api/humane-error.ts`   | The markup-is-not-prose case, so a proxy's 502 does not reach a user as "Unexpected token '<'"                                                                                                                                                      |
| `types-pmt/permissions.ts`      | `types/permissions.ts`      | 59 permissions, checked member for member against the published enum                                                                                                                                                                                |
| `types-pmt/auth.ts`, `users.ts` | `types/auth.ts`, `users.ts` | Verified against `/api/docs-json`. **Note the recorded defect**: `role` and `status` must be `{ value, label, tone }`, not strings                                                                                                                  |
| `contexts-pmt/role-context.tsx` | `contexts/role-context.tsx` | Reads `GET /users/me/permissions` and fails closed. Replaces any static role to permission map                                                                                                                                                      |
| `proxy.pmt.ts`                  | `proxy.ts`                  | PMT's cookie shape and route guard, inside the reference's proxy structure                                                                                                                                                                          |

Then **delete `reference-notes/` entirely**, and remove its two exclude entries.

### Rebrand

| Item                                                                | Work                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `public/logo/`                                                      | PixelVega marks, light and dark. `app-sidebar.tsx` reads both                   |
| `public/images/`, `public/auth/`, `public/footer/`, `public/icons/` | Delete what nothing references. About 30MB of another product's art             |
| `.env.local.example`, `.env.production.example`                     | Rewrite for PMT's variables. Keep the reference's comments-explaining-why style |
| `README.md`                                                         | PMT's own, from `reference-notes/README.reference.md` as the model              |
| Brand strings and the `frontend-root` login token fork              | Island Tours wording and palette out, PixelVega in                              |

## The module recipe

Every module in every phase below follows this, without exception. It is refactor Phase 8's recipe,
unchanged.

1. `types/<module>.ts`. Types only, verified field for field against the live `/api/docs-json`. A
   `type` alias, never an `interface`, because TanStack Table 9's generic constraint needs it.
2. `lib/api/<module>.ts`. One function per endpoint, on `apiFetch`. No types declared here.
3. `hooks/<domain>/use-<domain>.ts`. A key factory first, then queries, then mutations. Every
   invalidation goes through the factory. Paginated lists set `placeholderData: keepPreviousData`.
4. Components, split seven ways: `-list-view`, `-table`, `-columns`, `-row-actions`, `-form`,
   `-delete-dialog`, and `-detail-shell` where there is an `[id]` route.
5. `page.tsx` stays a Server Component. `"use client"` sits on the lowest leaf that needs state.
6. Forms are React Hook Form plus Zod, with the schema mirroring the DTO's rules. Where they
   disagree, the backend is right and the schema is the bug (D5).
7. List state goes through `useTableState`. Sorting, filtering and paging are query params, never
   array methods.
8. **Delete every computation the backend now serves.** If you reach for `.sort(`, `.reduce(` or
   `.filter(` under `components/`, the work belongs in the backend.
9. Tests: the four view states (loading, empty, error, loaded) and every form rule.
10. Ask before running `frontend-code-reviewer` and `migration-reviewer`, then open the PR.

---

## The phases

Twelve phases. D0 and D1 block everything. After that, D2 and D3 come next because the fake dashboard
is the most visible defect in the product. D5 through D8 are independent of each other and can be
reordered or run in parallel by different people.

```
D0  shell and design system      ← blocks everything
D1  the module kit               ← blocks every screen
D2  backend: dashboards          ← the urgent one
D3  frontend: four dashboards
D4  backend: contract gaps       ← blocks D5
D5  projects, list to detail       the biggest single phase
D6  time tracking and standups
D7  blockers, requirements, reviews, feedback
D8  people, leave, notifications, audit, client portal
D9  the AI module
D10 the named gaps                 timeline, exports, versions, reopen, working window
D11 hardening and close
```

---

### Phase D0: mirror, then prune

**Goal.** `pmt-frontend` is the reference with its domain removed, PMT's API contract folded in, and
PixelVega branding. Every gate green. No PMT feature screens yet.

The first half is done. See [The copy is done](#the-copy-is-done) for what landed and what it verified.

**The second half, in order. The risky steps first.**

1. **Fold PMT's API contract in** before anything else, because every later step compiles against it:
   `fetch.ts`, `humane-error.ts`, `types/permissions.ts`, `types/auth.ts`, `types/users.ts`,
   `contexts/role-context.tsx`, `proxy.ts`. Keep the reference's structure and the PMT specifics both.
   Run the specs that came with each.
2. **Point the app at the PMT API.** The reference reads `NEXT_PUBLIC_BACKEND_URL` and posts cache
   revalidations to a public site that does not exist here. Rewrite `next.config.ts`, `proxy.ts` and
   the env examples for backend `:5050` and frontend `:3000`. Delete the revalidation path and
   `lib/cache-tags.ts` with it: there is no public site to revalidate.
3. **Rewrite `navigations/navigations.ts`** for PMT's routes and its 59 permissions, keeping the
   grouping-by-task-frequency structure. The command palette reads the same tree, so both move at once.
4. **Delete the domain**, one folder per commit, so a mistaken deletion is one `git revert`. After each,
   `typecheck` names every orphaned import.
5. **Delete the route tree** under `app/(app)/` for the deleted domains, and reshape the route groups
   for PMT: `(app)` stays the authenticated shell, `(login)` becomes the single staff and client door,
   `(onboarding)` keeps the forced password change and profile completion.
6. **Prune the dependencies** only those domains used, then reinstall and rebuild.
7. **Rebrand**: logos, the login token fork, wording, `README.md`, `.env.*.example`.
8. **Prune `public/`.** About 30MB of another product's art. Delete what nothing references.
9. **Delete `reference-notes/`** and its two exclude entries.
10. **Fix the 16 inherited lint errors** that survive in kept files. Most are in domain files and go
    with them.

**What could break, and what catches it.** Deleting a domain folder usually orphans an import in a
kept file, which is exactly what `typecheck` reports by name, so the loop is delete, typecheck, fix.
The genuinely risky step is 2: pointing at the wrong API or getting the cookie shape wrong produces a
login screen that looks fine and never authenticates. Check it against the running backend, not
against a mock, the way refactor Phase 7 checked its proxy guard.

**Do not** take the chance to redesign anything while pruning. A kept file changes for one of three
reasons only: it referenced a deleted domain, it needed the PMT contract, or it carried Island Tours
branding.

**Exit criteria.**

- No reference domain remains in `app/`, `components/`, `hooks/`, `lib/` or `types/`.
- `reference-notes/` is deleted, and nothing excludes it any more.
- Every call goes to the PMT API, and a real session works end to end against `:5050`.
- The sidebar and the palette are built from PMT's permissions.
- No Island Tours asset, colour or wording remains.
- `lint · typecheck · test · build` green, with lint at **0 errors**.
- The contrast gate passes: `pnpm gate:contrast`.

### Phase D1: the module kit

**Goal.** Nothing in the phases after this one has to invent a pattern. Every screen builds out of
pieces that already exist.

**Most of this phase is already in the repo**, because the mirror brought the reference's whole
shared layer with it. What is left is the PMT data layer, plus the handful of shared pieces this
product needs and the reference had no reason to have.

**Already present, do not rebuild:** `components/data-table/*` and `useTableState` ·
`components/skeletons/*` · `components/common/entity-detail-shell.tsx` and `entity-tabs.tsx` ·
`components/common/status-badge.tsx` · `components/common/save-error.tsx` ·
`components/common/force-delete-dialog.tsx` and `deactivate-dialog.tsx` ·
`components/common/detail-sheet.tsx` and `quick-edit-sheet.tsx` ·
`components/common/collapsible-card.tsx` · `components/common/notification-bell.tsx` ·
`components/common/media-upload-zone.tsx` · `components/providers/query-provider.tsx` ·
`lib/api/fetch.ts` and `query.ts` · `components/statistics.tsx` as the stat vocabulary.

**Work.**

1. **Types for every domain**, verified against `/api/docs-json`: `projects`, `members`, `documents`,
   `time-entries`, `work-reports`, `blockers`, `requirements`, `reviews`, `feedback`, `leave`,
   `holidays`, `notifications`, `audit-logs`, `reports`, `ai`, `dashboard`.
2. **API clients** for the modules that have none. Present today: `projects`, `users`, `profiles`,
   `blockers`, `leave`, `audit-logs`, `daily-work-reports`, `additional-requirements`,
   `internal-reviews`, `client-feedback`, `meeting-time`, `reports`, `auth`. Missing: `members`,
   `documents`, `time-entries`, `notifications`, `ai-templates`, `ai-jobs`, `project-summary`,
   `status-reports`, `blocker-reasons`, `holidays`, `leave-types`, `leave-balances`,
   `project-reports`, `developer-reports`, `dashboard`.
3. **Hooks with key factories** for each of the above, under `hooks/<domain>/`.
4. **The pieces the reference had no reason to have**, added under `components/common/` in the
   reference's own style, never as a new pattern:

   | Piece                                  | What it does                                                                                                                                                                                                                     |
   | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `enum-badge.tsx`                       | Takes `{ value, label, tone }` and renders the label at that tone. **The only place tone becomes a class.** No component may declare its own label or tone map                                                                   |
   | `capability-gate.tsx`                  | Renders children when a resource's capability flag is true. Gates a row from its own flags, a screen from `usePermissions()`                                                                                                     |
   | `stats/` split out of `statistics.tsx` | The reference computes growth, ratios and money inside that file. Split its vocabulary into small files that each take **already-computed** props, because those numbers are response fields here (D4). The look does not change |
   | `date-range-control.tsx`               | The range presets every report and dashboard screen shares. Lift the reference's `lib/analytics/range-presets` shape rather than inventing one                                                                                   |
   | `filter-bar.tsx`                       | Query-param filters wired to `useTableState`                                                                                                                                                                                     |
   | `timeline.tsx`                         | The vertical activity timeline, reused by project activity, review rounds and feedback rounds                                                                                                                                    |
   | `reason-dialog.tsx`                    | "Type a reason, then confirm." Reused by on hold, cancel, reject, changes required, reopen                                                                                                                                       |
   | `view-states.tsx`                      | Loading, empty, error and loaded, so no screen writes its own                                                                                                                                                                    |
   | `export-button.tsx`                    | Kicks off an export and handles the download. Wired in D10, built here                                                                                                                                                           |

5. **Land the three ESLint groups as `warn`**: design tokens, dependency direction, and presentation
   only. They flip to `error` in D11. Refactor Phase 8 specifies exactly this sequencing.

**Exit criteria.** No screen fetches without a hook. No local tone or label map exists anywhere. The
three lint groups run at `warn` with a known, written-down count of violations. Nothing in this phase
introduced a pattern the reference does not already use.

---

### Phase D2: backend, the dashboards

**Goal.** Kill the hardcoded numbers at the source. `features.md` names this as the one thing to fix
first, because it is the tool stating something untrue on the first screen anyone sees.

**Work.** A new module at `src/dashboard/`, following the module shape in `pmt-backend/CLAUDE.md`.

- `GET /dashboard` returns the caller's dashboard. One route, and the response carries an `audience`
  discriminator plus exactly one populated block: `admin`, `manager`, `staff` or `client`. **The
  backend decides which**, because "work out which dashboard I am entitled to" is derivation, and
  deriving it in the browser is D4's exact prohibition. This is worth an ADR: `docs/decisions/0005-the-dashboard-is-one-endpoint-with-an-audience-discriminator.md`.
- A new `VIEW_DASHBOARD` permission in `prisma/enums.prisma`, granted to all six roles in
  `ROLE_PERMISSIONS`.
- Every figure is a response field with a `label` alongside it, following ADR 0003: exact values in
  the API, rounding is display.
- **Ordering is server side.** Requirements Q6 and Q7: the staff block's project list arrives ordered
  by priority, then deadline, then planned start date, with Ready For Work and In Progress ahead of
  completed or inactive projects. The browser renders the array in the order it arrived.
- A rate is `null`, never zero, when its denominator is zero. That convention is already established
  in `developer-report.dto.ts` and its reasoning is written there.

**What each audience gets** (first cut, to confirm against what the team actually looks at):

| Audience            | Blocks                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin, System Admin | Projects by status, projects at risk (deadline inside N days, or blocked), open blockers by severity, team hours this week against target, pending leave requests, pending additional requirements, standup compliance today, recent audit events |
| Project Manager     | The same shaped to projects they manage, plus their internal review queue, their requirements inbox, projects awaiting client feedback, and their team's standup compliance                                                                       |
| Developer, Designer | My projects, ordered as Q6 and Q7 require, my active timer, my hours today and this week, my open blockers, my standup state today, my leave balance                                                                                              |
| Client              | My projects with status and deadline only, and whether a project is waiting on my feedback                                                                                                                                                        |

**Exit criteria.** `GET /dashboard` returns a complete payload for all six roles. Service specs cover
every audience branch and the ordering rule. Swagger published. No number the frontend needs is
missing, checked by building D3 against it.

---

### Phase D3: frontend, the four dashboards

**Goal.** Requirements Q1 to Q9. Delete `dashboard-overview.tsx` and its hardcoded 8 and 14.

**Work.** `components/dashboard/` is gone after D0, so this lands as `components/home/`:
`home-view.tsx` reads `audience` and renders one of `admin-dashboard.tsx`,
`manager-dashboard.tsx`, `staff-dashboard.tsx`, `client-dashboard.tsx`, all built from the D1 stat
kit. `app/(dashboard)/dashboard/page.tsx` stays a Server Component holding the title and the view.

**Exit criteria.** No hardcoded figure anywhere in the frontend, verified by grep. Each of the six
roles lands on a dashboard built for their job. Every card renders correct loading, empty and error
states, because an empty dashboard is the common case on a fresh install.

---

### Phase D4: backend, the contract gaps that unblock screens

**Goal.** Two small additions that D5 cannot be built honestly without.

1. **A plain English explanation on every status** (E3). `EnumDisplayEntry` in
   `src/common/utils/enum-display.util.ts` is `{ label, tone }` today. Add `description`, and write
   one sentence for each of the ten project statuses and the five priorities. The type is
   `Record<TheEnum, EnumDisplayEntry>`, so adding the field fails the build until every member has
   one, which is the point. Requires a matching change to `EnumDisplayDto`, so it is a contract change
   that every consumer sees: worth its own PR.
2. **A `readiness` block on the project response** (D3). `{ hasProjectManager, hasDeveloperOrDesigner,
isReadyToLeavePlanning, blocking: [{ code, message }] }`. The rule exists in `ProjectsService` as a
   transition guard, so today a user finds out by trying and being refused. Move the answer into the
   response so the screen can show it before they try.

**Exit criteria.** A screen can explain a status and show a readiness checklist without writing a
single sentence of its own about either.

---

### Phase D5: projects, list to detail

The biggest phase, and the one to split most carefully. `project-detail-view.tsx` is 3,339 lines.
Refactor Phase 8 is explicit about this: split by tab with no behaviour change first, then migrate
each tab's data layer separately, and **never in one PR**.

**PR 1, the list.** `projects-list-view`, `-table`, `-columns`, `-row-actions`, on `useTableState`
with server-driven filters, sort and paging. Requirements D5 to D8, and the status and priority
badges through `EnumBadge`.

**PR 2, create.** Name, client, one or more types required (C2, C3); description, start date and
deadline optional (C4). Zod mirroring the DTO.

**PR 3, the split.** `project-detail-shell` plus one file per tab, moved verbatim. No data layer
changes, no behaviour changes. This PR should be almost entirely cut and paste, and it should be
reviewable in an afternoon.

**PR 4 onward, one tab at a time.** Each gets its own hook and its own tests:

| Tab       | Requirements                                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview  | D3 readiness checklist, D7 and D8 hours against estimate, E3 the status explanation, E13 archive                                                                        |
| Team      | D1 assign, D2 the workload warning the members endpoint already returns, D4 former members shown separately, D11 several of each role, C7 availability before assigning |
| Status    | E2 the fixed route, E4 who may advance, E5 Admin-only cancel, E6 the required reason through `ReasonDialog`                                                             |
| Documents | F1 to F6, and F7 the client's reduced view                                                                                                                              |
| Activity  | D9, already working. Move it onto the shared `Timeline`                                                                                                                 |
| Reports   | R1, on the existing project report endpoint                                                                                                                             |

**Exit criteria.** No file in `components/projects/` over 400 lines. Every tab has its own hook and
tests. `project-detail-view.tsx` no longer exists.

---

### Phase D6: time tracking and standups

**Time tracking** (G1 to G11). The centrepiece is a **global timer in the site header**, mounted at
the shell rather than per page, because one active timer per person is a global fact (G6) and a
page-level mount would lose it on navigation. Start, pause, resume, stop, and a note (G2 to G5).
Then the "who is working right now" board (G7), the totals screens (G8) and the meeting timer (G10).

Only a Developer or Designer assigned to the project may start a timer there (G1). That is already a
capability flag on the project response, so the control is gated from the flag and never from a role.

**Standups** (H1 to H7). One form covering all of a person's projects for the day, submitted in one
action (H3). A wrap-up on the same projects. A PM review queue with a comment per entry (H5), scoped
to projects they manage (H7), and filters by person, date range and type (H6).

**Exit criteria.** A developer can run a full day through the tool: start a timer, submit a standup,
pause for lunch, resume, submit a wrap-up, stop. A PM can read and comment on every entry they own.

---

### Phase D7: blockers, requirements, reviews and feedback

Four modules that share a shape: a list, a create form, a decision action and a history.

**Blockers** (I1 to I13). The cross-project list with filters, the per-project list, the reason list
admin screen (I4), assignment (I6), resolution notes (I8), deadline impact days (I9), and the
per-project deadline impact screen the endpoint already serves (I10).

**Additional requirements** (J1 to J8). The PM's inbox, create with a source channel, approve or
reject with extra hours and a deadline shift, and the permanent approver record.

**Internal reviews** (K1 to K6). Submit a round with a decision and comments, and the round history so
a second round can be read against the first. This is the "Internal Review is a status with no
content" gap in `features.md`, and the backend already closed it: only the screen is missing.

**Client feedback** (L4 to L8). The client's own Approved or Changes Requested action, the PM
recording it on the client's behalf, and the round history.

**Exit criteria.** Every decision in the product that requires a written reason captures one through
the same `ReasonDialog`. Every round-based history renders through the same `Timeline`.

---

### Phase D8: people, leave, notifications, audit and the client portal

**People** (B4 to B9). Profile with work status and availability (B6, B7), the workload view (B8), and
the handover view a reassigned developer lands on (D14).

**Leave** (M1 to M8). Request, own balance, the holiday calendar, leave types admin, the PM's
read-only review queue (M5) and the Admin's approve and reject (M6). The read-only distinction matters
and is a real rule, not an oversight: gate it from `REVIEW_LEAVE_REQUEST`, never from the role.

**Notifications** (O1, O2). A bell with an unread count in the site header, and an inbox.

**Audit log** (P1). Already working. Move it onto the module recipe.

**Client portal** (L1 to L3, L9, L10). Own projects only, status and deadline, the deliverable
documents (X2's resolution), and a notice when a status changes.

**Exit criteria.** Sign in as each of the six roles and reach every screen that role should have, and
none that it should not.

---

### Phase D9: the AI module

The backend serves three of the five AI features already. This phase builds all five screens and the
two missing services.

**Frontend for what exists.** Templates CRUD with the one-default-per-kind rule (R3), the scope check
request and verdict panel (R4 to R7), the live project summary (R8), the status report generator and
its history (R10, R11), and the job polling the two background features need (R13).

Three rules from `AI Integration Module.md` that the UI has to make visible, because getting them
wrong is worse than not shipping the feature:

- A scope check is **never automatic**. A PM asks for it, explicitly.
- A scope check is **a suggestion**. It never approves, rejects or blocks. The approve and reject
  buttons work regardless of what it said, and the approved hours are the PM's number.
- A project summary is **never saved**. Nothing in the UI may imply a history of them, because there
  is not one.

**Backend additions.** AI hours estimate (C6, R15), offered at creation and re-runnable, with the PM's
value always the one stored (conflict X5). AI PRD generation (R14). The three remaining on-demand
reports (R16).

**Exit criteria.** All five AI features reachable, and every rule in the AI document either enforced
or visibly stated on screen.

---

### Phase D10: the named gaps

Everything `features.md` lists under "tool does not do" that is not already covered above. Each item
is backend plus frontend, and they are independent of each other.

| Item                                   | Requirements      | Work                                                                                                                                                                                  |
| -------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeline and Gantt                     | S1, S3, S4        | A timeline endpoint returning already-laid-out bars per member, and a per-week workload endpoint. The browser draws, it does not lay out                                              |
| Exports                                | T1 to T4, S2, R17 | CSV for project lists, blockers and time; PDF for reports and the timeline. Follow the existing leave summary export: it already sets `text/csv` and a `Content-Disposition` filename |
| Document version history               | F8                | A version row per upload, with the current version resolved server side                                                                                                               |
| Contracts                              | F9                | A `CONTRACT` document type                                                                                                                                                            |
| Reopening a closed project             | E12               | Admin only, a required reason, recorded as an activity. Resolves conflict X3                                                                                                          |
| The working window on a timer          | G12               | Count only 9am to 6pm, Saturday to Thursday. `src/common/working-day/` already holds the constants, and the report services already use them                                          |
| Auto-close a running timer             | G13, U4           | A cron. Decide what the entry records: capping at 6pm is the honest option, and it must be visibly marked as auto-closed                                                              |
| Promote a Scheduled project            | E9, U3            | A cron that moves a Scheduled project to Ready For Work when its planned start date arrives                                                                                           |
| A revision checklist on a review round | K7                | Revision items against a `ProjectInternalReview`, each markable done                                                                                                                  |
| Scheduled reports                      | U5                | Last. Depends on exports landing. First candidate to drop if time runs short                                                                                                          |

The two cron items and the working window are the ones to be most careful with: they change stored
numbers, and a bug in either silently corrupts everyone's hours. Both need service specs covering the
boundary cases (a timer started at 5:55pm, a timer spanning a Friday, a timer started before 9am)
before they go anywhere near real data.

---

### Phase D11: hardening and close

1. Flip the three ESLint groups from `warn` to `error`: design tokens, dependency direction,
   presentation only.
2. Playwright, one journey per role, on storage-state auth: `pmt-frontend/e2e/tests/`.
3. Confirm the exit criteria inherited from refactor Phase 8: no component over 400 lines, no
   `useEffect` plus `fetch`, no derivation, sorting, filtering or aggregation under `components/`.
4. `lint · typecheck · test · test:e2e · build`, both packages, all green.
5. Update `pmt-frontend/CLAUDE.md`, `docs/refactor/02-checklist.md`, `docs/refactor/03-progress.md`
   and `docs/README.md` in the same PR as the work they describe.
6. Write the ADRs this build earned: the dashboard's audience discriminator, and whichever of the six
   conflicts were resolved by a judgment rather than by a document.

---

## Sequencing and parallelism

```
D0 ──► D1 ──┬──► D2 ──► D3
            │
            ├──► D4 ──► D5
            │
            ├──► D6
            ├──► D7
            ├──► D8
            └──► D9 ──► D10 ──► D11
```

- **D0 then D1, strictly.** Every screen depends on both.
- **D2 and D3 next**, because the fake dashboard is the most visible defect and the cheapest large win.
- **D4 before D5.** D5's Overview and Status tabs need the readiness block and the status explanation,
  and building them without those means writing sentences in the browser that have to be deleted.
- **D5 through D9 are independent.** Different people can take them in parallel. Within D5, the four
  PRs are strictly ordered.
- **D10 after D9**, because its export work reuses the report surfaces D9 finishes.
- **D11 last**, and only once.

---

## Risks

| Risk                                                                                                                                                       | Mitigation                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pointing at the wrong API, or the wrong cookie shape.** A login screen that looks right and never authenticates, while `typecheck` and `build` both pass | D0 step 2 is checked against the running backend on `:5050`, not against a mock, the way refactor Phase 7 checked its proxy guard                                                 |
| **Deleting a domain folder orphans an import in a kept file**                                                                                              | One folder per commit, `typecheck` after each. It names every orphan, and a bad delete is one `git revert`                                                                        |
| **The prune turns into a redesign.** "While I am in here" is how a mirror stops being a mirror                                                             | A kept file changes for three reasons only: it referenced a deleted domain, it needed the PMT contract, or it carried Island Tours branding. Anything else is a separate decision |
| Another product's secrets reach this repo                                                                                                                  | `.env.local` was excluded from the copy. It holds a live `INTERNAL_API_SECRET`, a revalidation secret and a backend URL. Never copy it                                            |
| D5 becomes one enormous PR                                                                                                                                 | Four PRs, fixed. PR 3 is a pure move with no behaviour change, and if its diff shows logic changes it is wrong                                                                    |
| The working window and the auto-close cron corrupt stored hours                                                                                            | Service specs on the boundary cases first, then a dry run that logs what it would change before it changes anything                                                               |
| A screen is built against a number the dashboard endpoint does not return, and someone computes it in the browser to unblock themselves                    | D2's exit criterion is that D3 builds against it without adding a computation. A `.reduce(` under `components/` is a backend ticket, not a fix                                    |
| The 16 inherited lint errors become permanent, because they were there on day one                                                                          | Lint at **0 errors** is a D0 exit criterion, not a D11 one. Most of them live in domain files and leave with them                                                                 |
| **The mirror brings the reference's browser-side computation with it.** `statistics.tsx` computes growth, ratios and money in a component                  | The presentation-only lint group lands at `warn` in D1 with a written-down violation count, so the number can only go down. Every such number is a response field here (D4)       |
| Six documented conflicts get decided ad hoc, differently, by whoever hits them first                                                                       | All six are listed in `00-requirements.md` with a recommendation. Decide them before D5, and record each as an ADR                                                                |

## Open questions

Answer these as they come up rather than up front, and record each answer where the reasoning will be
found again.

1. The six conflicts in [`00-requirements.md`](./00-requirements.md#conflicts-to-resolve). X1, X2 and
   X3 change stored behaviour and need answers before D5.
2. Is the dashboard one endpoint with an `audience` discriminator, or four routes? The plan recommends
   one, and the reasoning is in D2.
3. What does an auto-closed timer record: the true elapsed time, or the time capped at 6pm?
4. Can a wrap-up be submitted with no standup that day, and can a missed standup be filed late?
5. Should annotating a design (K8) be scheduled at all, or dropped from v1 on the record?
6. ~~Does the reference's `lib/api/fetch.ts` carry either of the two defects PMT already fixed?~~
   **Answered by reading it.** Neither. It catches a non-JSON error body, and it catches a non-JSON
   2xx body and substitutes a safe sentence rather than letting a `SyntaxError` reach a toast. It has
   **no timeout at all**, though, so the abort-signal defect cannot exist there because the feature
   does not. It also adds retry backoff on 429 and 503, which PMT's does not. So the fold is: the
   reference's 106 line client, plus PMT's 15 second timeout, minus `revalidatePublicForPath`.
7. `input-otp` is a reference dependency. Does PMT's forgot-password flow send a code, which needs an
   OTP field, or a link, which does not? `features.md` says a code.
