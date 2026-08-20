# Dashboard v1: checklist

The work in [`01-plan.md`](./01-plan.md) as tickable items, with the requirement each one satisfies
from [`00-requirements.md`](./00-requirements.md).

**Tick this file in the same PR as the work, from evidence.** The command that passed, the file that
now exists. Never from memory of having intended to do it. When an item is half done, say which half.
A stale checklist is worse than no checklist, because the next person trusts it.

## Progress

| Phase | What                                        | Items   | Done    | Status      |
| ----- | ------------------------------------------- | ------- | ------- | ----------- |
| ~     | Decisions to make first                     | 9       | 0       | not started |
| D0    | Mirror, then prune                          | 99      | 68      | in progress |
| D1    | The module kit                              | 29      | 0       | not started |
| D2    | Backend, the dashboards                     | 50      | 45      | in progress |
| D3    | Frontend, the overview                      | 15      | 15      | done        |
| D4    | Backend, the contract gaps                  | 7       | 0       | not started |
| D5    | Projects, list to detail                    | 52      | 24      | in progress |
| D6    | Time tracking and standups                  | 26      | 7       | in progress |
| D7    | Blockers, requirements, reviews, feedback   | 31      | 5       | in progress |
| D8    | People, leave, notifications, audit, client | 30      | 4       | in progress |
| D9    | The AI module                               | 24      | 0       | not started |
| D10   | The named gaps                              | 29      | 1       | in progress |
| D11   | Hardening and close                         | 16      | 0       | not started |
|       | **Total**                                   | **409** | **157** |             |

Regenerate the counts with
`awk '/^## /{if(s!="")print s": "n; s=$0; n=0} /^- \[ \]|^- \[x\]/{n++} END{print s": "n}' 02-checklist.md`
rather than adjusting them by hand.

## Decisions to make first

Six conflicts and three questions block work downstream. None is a research task: each needs someone
to choose. Record each as an ADR under `docs/decisions/`.

- [ ] **X1 Archiving.** Independent of status (`Project Module.md`) or Completed and Cancelled only (`features.md`, and what the backend does today). Blocks D5
- [ ] **X2 Client documents.** Deliverable only (`Project Module.md`) or none at all (`features.md`). Blocks D5 and D8
- [ ] **X3 Reopening.** Add an Admin-only reopen with a reason, or keep Completed and Cancelled final. Blocks D5 and D10
- [ ] **X4 Two timers.** One per person in total. Confirm, since the backend already enforces it
- [ ] **X5 Estimated hours.** AI suggests and the PM confirms, with the PM's number stored. Confirm
- [ ] **X6 Who reports a blocker.** Anyone assigned plus Admins on any project, which is what the backend does. Confirm
- [ ] **Dashboard shape.** One endpoint with an `audience` discriminator, or four routes. Blocks D2
- [ ] **Auto-closed timers.** Record the true elapsed time, or cap at 6pm. Blocks D10
- [ ] **Design annotation (K8).** Schedule it, or drop it from v1 on the record

---

## Phase D0: mirror, then prune

`pmt-frontend` **is** `tripwheel-x-islandtours-dashboard`, copied whole. This phase removes the
reference's domain, folds PMT's API contract in, and rebrands. **No PMT feature screens yet.**

The rule, for every item below: a kept file changes for three reasons only. It referenced a deleted
domain, it needed the PMT contract, or it carried Island Tours branding. Anything else is a separate
decision, not a "while I am in here".

### The copy, done

- [x] Branch `feat/dashboard-mirror-tripwheel` off `refactor/phase-7-frontend-foundations`
- [x] Confirmed the old `pmt-frontend` was clean at `735de54`, so the deletion is recoverable
- [x] Old `pmt-frontend` deleted
- [x] Reference copied with `rsync -a`, excluding `.git`, `node_modules`, `.next`, `.env.local`, `tsconfig.tsbuildinfo`, `.DS_Store`, `.conductor`, `undefined/`, `dashboard-extraction/`, `public/videos/`, and the three generated `e2e/` artifact folders
- [x] `.env.local` **not** copied. It holds another product's live `INTERNAL_API_SECRET`, revalidation secret and backend URL
- [x] `package.json` renamed to `pmt-frontend`, `dev` and `start` on port 3000, `typecheck` script added
- [x] PMT's `CLAUDE.md`, `.env.example` and `.env.local` restored over the copy's
- [x] Displaced PMT files quarantined in `reference-notes/` with a README explaining each and when it dies
- [x] `reference-notes/` excluded from `tsconfig.json` and `vitest.config.ts`, with the reason in a comment
- [x] `pnpm install`
- [x] Baseline verified on the verbatim copy: `typecheck` 0 errors · `test` 31 files 227 passing · `build` succeeds with partial prerendering · `lint` 16 errors and 48 warnings, all inherited

### Fold PMT's API contract in, before anything else

Every later step compiles against this, so it goes first.

- [x] `lib/api/fetch.ts`: the reference's 106 line client, **plus** PMT's 15 second timeout (the reference has no timeout at all), **minus** `revalidatePublicForPath`. Keep its retry backoff on 429 and 503, which PMT's client lacks. Both of PMT's fixed defects are already absent there, checked by reading it
- [ ] `lib/api/humane-error.ts`: keep the markup-is-not-prose case, so a proxy's 502 does not reach a user as "Unexpected token '<'"
- [ ] `types/permissions.ts`: PMT's 59 permissions, checked member for member against the published enum
- [ ] `types/auth.ts` and `types/users.ts`, verified against `/api/docs-json`
- [ ] **Fix the recorded defect while doing it**: `role` and `status` are `{ value, label, tone }`, not strings. Refactor Phase 7 logged this as knowingly unfixed
- [x] `contexts/role-context.tsx`: PMT's, reading `GET /users/me/permissions` and failing closed. No static role to permission map survives
- [ ] Run every spec that came with those files, and keep them

### Point the app at the PMT API

- [ ] `next.config.ts` for backend `:5050` and frontend `:3000`
- [ ] `proxy.ts`: the reference's structure, PMT's cookie shape and route guard
- [x] Delete the cache revalidation path and `lib/cache-tags.ts`. There is no public site to revalidate here
- [ ] `.env.local.example` and `.env.production.example` rewritten for PMT's variables, keeping the reference's comments-explaining-why style
- [ ] **Checked against the running backend, not a mock**: no cookie plus a deep link gives a redirect to login carrying `next`; a cookie plus `/login` redirects into the app; `_next/*` is untouched by the matcher

### Navigation, from PMT's permissions

- [x] `navigations/navigations.ts` rewritten for PMT's routes and its 59 permissions, keeping the grouping-by-task-frequency structure
- [x] The command palette reads the same tree, so the two surfaces cannot drift
- [x] `navigations.test.ts` updated: an item without the permission is dropped, and a group left empty is dropped with it

### Delete the reference's domain, one folder per commit

After each, `typecheck` names every orphaned import.

- [x] `attributes` · `availability` · `bookings` · `calendar` · `cancellation-requests`
- [x] `categories` · `collections` · `customers` · `destinations`
- [x] `email-centre` · `homepage` · `hubs` · `locals-favourites`
- [x] `media` · `pages` · `payments` · `recommendations`
- [x] `reviews` · `settlements` · `spotlight` · `submissions`
- [x] `translations` · `trips` · `operators`
- [x] Each domain's `hooks/<domain>/`, `lib/api/<domain>.ts`, `types/<domain>.ts` and `app/(app)/<domain>/` go with it
- [x] The domain libraries under `lib/`: `analytics`, `bookings`, `email-centre`, `emails`, `home-page`, `media`, `operators`, `recommendations`, `settings`, `tours`, `trips`
- [x] `lib/public-site.ts` · `lib/island-time.ts` · `lib/translatable-schema.ts`
- [ ] Reshape the route groups for PMT: `(app)` is the authenticated shell, `(login)` the staff and client door, `(onboarding)` the forced password change and profile completion

### Keep, and confirm untouched

- [x] `components/shell/*` · `components/ui/*` (all 33) · `components/data-table/*` · `components/skeletons/*`
- [x] `components/common/*` minus the domain files
- [ ] `components/statistics.tsx` and `page-components.tsx`, rewritten for PMT figures in D3 with **the shape unchanged**
- [x] `components/providers/query-provider.tsx`, exactly as configured
- [x] `components/onboarding/*` · `components/login/*` · `components/profile/*` · `components/staff/*`
- [x] `lib/stores/` · `lib/async/` · `lib/motion.ts` · `lib/utils.ts` · `lib/constants/` · `lib/validations/` · `lib/server/` · `lib/currency/` · `lib/config/`
- [x] `hooks/use-mobile.ts` · `use-drag-scroll.ts` · `use-sync-form-when-pristine.ts` · `use-unsaved-guard.ts` · `use-visible-section.ts`
- [x] `zustand`, `@hugeicons/*`, `framer-motion`, `recharts`, `date-fns`, `react-day-picker`, `cmdk` all stay, **because the reference uses them.** User decision, on the record
- [x] The verification apparatus: `e2e/` harness · `playwright.config.ts` · `vitest.config.ts` · `eslint.config.mjs` · `scripts/contrast-gate.mjs`

### Prune the dependencies only the deleted domains used

- [x] `leaflet` · `react-leaflet` · `@types/leaflet`
- [ ] `react-easy-crop`
- [x] `@codemirror/lang-html` · `@uiw/react-codemirror` · `@uiw/codemirror-theme-github`
- [x] `@tiptap/*`
- [ ] `input-otp`, **only if** PMT's forgot-password flow sends a link rather than a code. `features.md` says a code, which needs the field
- [x] Reinstall and rebuild

### Rebrand

- [ ] `public/logo/`: PixelVega marks, light and dark. `app-sidebar.tsx` reads both
- [ ] Prune `public/`: about 30MB of another product's art across `images/`, `auth/`, `footer/`, `icons/`. Delete what nothing references
- [ ] The `frontend-root` login token fork: Island Tours palette out, PixelVega in
- [ ] Brand wording across the app
- [ ] `README.md` for PMT, using `reference-notes/README.reference.md` as the model

### The purple palette, applied

The user supplied a token set and asked for the VALUES to be mapped onto the existing token
architecture, keeping every token name. Done, with three deviations, each recorded next to the value
it governs in `app/globals.css`.

- [x] Brand ramp is PURPLE at hue ~324, anchored so `--color-brand-600` is the given light primary (`oklch(0.37 0.14 323)`) and `--color-brand-400` the given dark primary (`oklch(0.58 0.14 327)`)
- [x] Neutral ramp is near-achromatic, matching the given neutrals. The darkest three keep a whisper of the brand hue, where the given foreground puts it
- [x] Light surface model INVERTED to match the given palette: the canvas is white and cards sit one step darker, where before the canvas was tinted and cards rose toward white
- [x] Dark canvas is the given `oklch(0.23 0.01 256)` slate, not the previous 0.09 near-black
- [x] `--secondary` and `--accent` given their own semantic tokens (`--surface-secondary`, `--surface-accent`), because the palette gives them different values and both used to alias `--surface-inset`. Every compat alias still points at exactly one semantic token
- [x] Focus ring is the primary, as the given `--ring` states
- [x] White primary ink in BOTH modes, as the given `--primary-foreground` states. Verified rather than assumed: the gate measures 4.60:1 in dark, so it clears 4.5:1
- [x] `--danger-solid` is the given `--destructive`, the same value in both modes
- [x] Shadow scale taken from the given `--shadow-*`
- [x] `scripts/contrast-gate.mjs` updated in lockstep, which its own header requires
- [x] `pnpm gate:contrast` GREEN

**Deviation 1: chart order.** The given light set opens with two purples one step apart, which are
indistinguishable and worse under protanopia. With purple first, the given second colour also
collapsed to 1.14:1 against the lighter dark-mode purple. The set was REORDERED, not changed: amber
(already in the set) moves to position two and clears both modes at 2.16:1 and 5.37:1. The order is
the same in light and dark, so a series does not change colour when the theme is toggled.

**Deviation 2: dark `--content-subtle`.** 0.60 measured 4.28:1 against the new slate canvas and
failed. Raised to 0.64.

**Deviation 3: dark shadows.** The given tokens repeat the light shadow block unchanged under
`.dark`, where a 10% black shadow is invisible against a 0.23 canvas. Same geometry, alpha raised
until the card edge reads.

**Not applied, needs a decision:**

- [ ] **Typography.** The given tokens set `--font-heading: var(--font-lato)`, `--font-body: var(--font-merriweather)` and `--font-mono: var(--font-roboto-mono)`, plus an h1 to h6 ramp. Not applied: Merriweather is a SERIF, and this is a dense table-heavy dashboard, so it is a bigger call than a colour swap and needs `next/font` wiring in `app/layout.tsx`. The current ramp (DM Sans headings, Geist body, IBM Plex Mono) is untouched. Say the word and it goes in
- [ ] **Radius.** The given `@theme inline` computes every radius as `calc(var(--radius) * n)` but never defines `--radius`, so adopting it verbatim would collapse every corner to zero. The existing fixed ladder is kept

### Auth, end to end and driven against the live API

The user's direction: "start with login, and auth management fully like reset password,
forgot-password and all others regarding auth." Done, and verified by signing in as real seeded
accounts rather than by mocking.

**One gate, not three.** The reference had `/portal`, `/staff` and a traveller door. All six PMT
roles sign in at `/login`, and what they may then see comes from `GET /users/me/permissions`. A
second door would be a second place for the redirect rules to disagree, and it leaks which audience
an email belongs to before anyone has authenticated.

- [x] `/login` — sign in, with `?next=` honoured through `safeRedirect`
- [x] `/login/forgot` — request a reset, enumeration-proof (the success state is unconditional; only rate limiting is named)
- [x] `/reset-password?token=` — from a forgot email
- [x] `/set-password?token=` — from an invite email. **Both paths are fixed by the backend**, which builds the link as `${APP_URL}/<path>?token=`; renaming either breaks every email already in an inbox
- [x] `/first-password` — the forced replacement of an invite's temporary password, while signed in. Needed because that person has a SESSION and no token, so `reset-password` cannot serve them: only `change-password` accepts a current password
- [x] `/account-suspended` — where a SUSPENDED account lands, instead of a shell of 403s
- [x] Profile password change, on `POST /api/auth/change-password`, revoking other sessions
- [x] `/account` — Account & User Management, replacing `/profile` (a 308 redirect). General (Personal Information, Email & Password, Connect Accounts, Social URLs, Danger Zone) and Security (active sessions). Spec and decisions: [`04-account-and-profile.md`](./04-account-and-profile.md)
- [x] The password policy is SERVED by `GET /profiles/options` and enforced by a `hooks.before` on all three better-auth paths that set a password, so the requirement checklist describes a real gate
- [x] `firstName` / `lastName` on `User`, with `name` recomposed on write and re-split when an admin writes it. Both directions in `common/utils/name.util.ts`
- [x] Self-service account deletion: soft delete plus session revocation in one transaction, refused for the SYSTEM_ADMIN
- [x] `proxy.ts` rewritten: one gate, `?next=` carried, malformed cookies stripped to break the redirect loop, and the emailed token routes left unguarded because the token IS the credential
- [x] `app/(app)/layout.tsx` gates on `status.value === 'SUSPENDED'` then `mustResetPassword`, in that order
- [x] `lib/server/app-session.ts` — one parallel wave: `getSession`, `/users/me`, `/users/me/permissions`
- [x] `contexts/role-context.tsx` carries `role` as `{ value, label, tone }`, not a string. **This fixes the defect refactor phase 7 logged and left**: eight call sites indexed `roleLabels[user.role]` with an object and rendered an empty badge
- [x] `lib/config/rbac.ts` mirrors the backend's 59 permissions and `ROLE_PERMISSIONS`. Verified: ADMIN and SYSTEM_ADMIN hold all 59, ADMIN is a strict superset of every lower role
- [x] `lib/safe-redirect.ts` rewritten for a root-mounted app, with 24 specs covering protocol-relative, backslash, control-character and auth-route cases

### Four defects found and fixed, three of them only findable by running it

| Found                                                                                                                                                                                                                         | Why nothing else caught it                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Every API call 404'd.** The copied client appended `/api/v1`; PMT's global prefix is `api`                                                                                                                                  | `typecheck` and `build` both pass. Found by starting the backend and reading its route table                                       |
| **The sign-in button stuck on "Signing in…" forever, silently.** `signIn.email` REJECTS rather than returning `{ error }` when the failure is below the API, and the handler had no `catch`, so `setLoading(false)` never ran | Found by driving the real form. The same hole was in all four other auth cards and in sign-out; all fixed with `try/catch/finally` |
| **`apiFetch` forced `Content-Type: application/json` on a `FormData` body**, so the boundary never reached the server and every multipart upload arrived unparseable                                                          | Nothing uploaded a file yet. This product uploads avatars and project documents                                                    |
| **A Suspense fallback that read `useSearchParams`.** Passing the real card as its own fallback put a dynamic read inside the boundary's fallback                                                                              | Caught by `next build` under `cacheComponents: true`, which is exactly what that flag is for                                       |

### One deliberate difference from `features.md`

`features.md` says a person who forgets their password "gets a code by email". The backend sends a
**link with a token**, built by better-auth's `sendResetPassword`. The backend is the authority, so
the screens implement the link flow. Worth confirming which was intended: a code needs a backend
change, not a frontend one, and `input-otp` is still installed for the day it is.

### The product has a name

`Vega`, in `lib/constants/product.ts`, alongside `COMPANY_NAME` ("PixelVega") and a tagline. Every
surface that says the name reads it from there: the browser title template, the login door, the
sidebar. **PixelVega is the company; Vega is the tool.** Renaming it is one edit.

- [x] Logo downloaded from the URL the user supplied and served from `public/logo/` in three variants: white for dark grounds, brand purple for light, and a `currentColor` version for inline SVG use
- [x] `app/icon.svg` is a square purple mark, because the wordmark is 181x24 and smears at 16px. The V is drawn as strokes, not set as text, so it does not depend on a webfont
- [x] The `--it-*` login token fork is deleted: 83 class replacements onto the main palette across 13 files, so the door and the app share one purple
- [x] Every "Island Tours", "Tripwheel", "operator", "portal" and "traveller" string is gone from shipped code, including the user-visible "Welcome to Tripwheel" in the site header
- [x] `TOUR_OPERATOR` is gone: `types/profile.ts` now carries PMT's `EmployeeProfile` and `ClientProfile` shapes with `role` as an `EnumDisplay`

### Verified by running it, not by mocking

| Checked                                         | Result                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Backend boots and serves 99 documented paths    | Yes, on `:5050`, against local Postgres and Redis                                     |
| `POST /api/auth/sign-in/email`                  | 200, returns the session token and the user                                           |
| Sign in as `admin@pixelvega.com` in the browser | Lands on `/`, shell renders, all five nav groups                                      |
| Sign in as `client@pixelvega.com`               | **Exactly two rows: Overview and Projects.** No Deliver, Insight, People or Configure |
| Console                                         | No errors                                                                             |
| Dark mode                                       | Slate canvas, white wordmark, purple active row                                       |

### Close the phase

- [ ] Read `reference-notes/CLAUDE.reference.md` for the cross-repo coupling notes and `TEST-AND-HARDENING-CHANGELOG.md` for defects already fixed there, so none is reintroduced
- [ ] **Delete `reference-notes/` entirely**
- [ ] Remove its exclude entry from `tsconfig.json`
- [ ] Remove its exclude entry from `vitest.config.ts`
- [x] Fix the inherited lint errors that survive in kept files

### Exit criteria, D0

- [ ] No reference domain remains in `app/`, `components/`, `hooks/`, `lib/` or `types/`
- [ ] `reference-notes/` is gone, and nothing excludes it
- [ ] Every call goes to the PMT API, and a real session works end to end against `:5050`
- [ ] Sidebar and palette both built from PMT's permissions
- [ ] No Island Tours asset, colour or wording remains
- [ ] `lint` at **0 errors** · `typecheck` · `test` · `build` all green
- [ ] `pnpm gate:contrast` passes

## Phase D1: the module kit

### Types, verified against `/api/docs-json`

- [ ] `types/projects.ts` · `types/members.ts` · `types/documents.ts`
- [ ] `types/time-entries.ts` · `types/work-reports.ts`
- [ ] `types/blockers.ts` · `types/requirements.ts` · `types/reviews.ts` · `types/feedback.ts`
- [ ] `types/leave.ts` · `types/holidays.ts` · `types/notifications.ts`
- [ ] `types/reports.ts` · `types/ai.ts` · `types/dashboard.ts`
- [ ] Every type is a `type` alias, not an `interface`, for TanStack Table 9's generic constraint

### API clients on `apiFetch`

- [ ] `members` · `documents` · `time-entries` · `notifications`
- [ ] `ai-templates` · `ai-jobs` · `project-summary` · `status-reports`
- [ ] `blocker-reasons` · `holidays` · `leave-types` · `leave-balances`
- [ ] `project-reports` · `developer-reports` · `dashboard`

### Hooks with key factories

- [ ] One `hooks/<domain>/use-<domain>.ts` per client above, key factory first
- [ ] Every invalidation goes through the factory. No inline key array anywhere
- [ ] Paginated lists set `placeholderData: keepPreviousData`

### The presentational kit under `components/common/`

- [ ] `enum-badge.tsx`. Takes `{ value, label, tone }`. **The only place tone becomes a class**
- [ ] `capability-gate.tsx`. Gates a row from its own flags, a screen from `usePermissions()`
- [ ] `stats/stat-card.tsx` · `trend-badge.tsx` · `donut-stat.tsx` · `chart-empty.tsx` · `breakdown-row.tsx`, each taking already-computed props
- [ ] `date-range-control.tsx`
- [ ] `filter-bar.tsx`, wired to `useTableState`
- [ ] `timeline.tsx`, shared by project activity, review rounds and feedback rounds
- [ ] `reason-dialog.tsx`, shared by on hold, cancel, reject, changes required and reopen
- [ ] `page-header.tsx` · `entity-detail-shell.tsx` · `entity-tabs.tsx`
- [ ] `view-states.tsx`: loading, empty, error, loaded
- [ ] `export-button.tsx`, built here and wired in D10
- [ ] `skeletons/`: list, detail and dashboard

### Lint, as `warn`

- [ ] Design token group at `warn`, with the violation count written down
- [ ] Dependency direction group at `warn`, with the count
- [ ] Presentation only group at `warn`, with the count: no `.sort(` / `.reduce(` / `.filter(` under `components/**`, no locally declared status or priority label and tone map

### Exit criteria, D1

- [ ] No screen fetches without a hook
- [ ] No local tone or label map exists anywhere in the app

---

## Phase D2: backend, the dashboards (Q1 to Q9)

### Seeing and managing are different questions

The permission model, as stated by the user and now enforced per project card:

| Role                | Sees                                        | Manages                                     |
| ------------------- | ------------------------------------------- | ------------------------------------------- |
| SYSTEM_ADMIN, ADMIN | every project                               | every project                               |
| PROJECT_MANAGER     | **every project**                           | **only projects they are staffed on as PM** |
| DEVELOPER, DESIGNER | only projects they are staffed on           | none                                        |
| CLIENT              | only their own projects, reduced projection | none                                        |

This resolves the question flagged earlier: a PM's **visibility** is unrestricted, and the narrowing
is on **authority**. So the query scope and the capability flags are two separate mechanisms, and
conflating them was the mistake the first draft nearly made.

- [x] `DashboardProjectCapabilitiesDto` on every card: `canManage`, `canTrackTime`, `isMember`
- [x] `canManage` = holds `EDIT_PROJECT` **and** (is unrestricted **or** is PM of this project)
- [x] `canTrackTime` = holds `TRACK_PROJECT_TIME` **and** is staffed on this project. Holding the
      permission is not enough: `features.md` says only assigned developers and designers may track
      time on a project
- [x] A PM's `canTrackTime` is false even where `canManage` is true, because a PM holds no tracking
      permission at all
- [x] "Unrestricted" is identified by a capability only an admin holds (`ARCHIVE_PROJECT`), never by
      a role string (D2)
- [x] **The service's own assertion must call the same predicate.** Two copies is the defect
      `pmt-backend/CLAUDE.md` names as the most repeated one here: five flags once shipped wider than
      their enforcement, each offering a button that then answered 403

### The query scope, enforced in the `where`

| Audience  | Projects it may see                                  | Filter                                                   |
| --------- | ---------------------------------------------------- | -------------------------------------------------------- |
| `ADMIN`   | every non-archived project                           | none                                                     |
| `MANAGER` | every non-archived project                           | none. The narrowing is on `canManage`, not on visibility |
| `STAFF`   | projects where they are an active member in any role | `members: { some: { userId, leftAt: null } }`            |
| `CLIENT`  | projects where `clientId` is them                    | `where: { clientId: userId }`                            |

- [x] **The filter is in the `where`, never in the mapper.** A mapper that drops rows is a leak the
      first time someone edits it, and the response would look correct while carrying data the caller
      may not have
- [x] Archived projects are excluded from every block
- [x] Every list is bounded by the service, never by a client-supplied page size
- [ ] A spec per audience asserting a project outside the caller's scope is absent from the response

### Data heavy, because a brief overview is the point

Whoever signs in should be able to answer "what is the state of my work" without opening anything
else. So one shape serves all three internal audiences and differs only in scope, which also means
the frontend builds one layout instead of three. A section that does not apply is **null rather than
empty**: null says "this does not concern you", empty says "there is nothing here", and a developer's
`topContributors` must not claim the team logged no hours.

- [x] `headline`: metric tiles, each with its value, its previous-window value, a delta and a tone
- [x] `hoursTrend`: one point per day, **gaps filled with zero**, because a chart that skips an empty
      day draws a line over the gap and implies work happened across it
- [x] `isWorkingDay` on every point, so a reader can tell the team's day off from a day nobody worked
- [x] `statusBreakdown` and `blockerBreakdown`: slices in the enum's declared order with shares
      computed **once** on the server, or clients rounding their own would stop summing to 100%
- [x] `topProjectsByHours` and `topContributors`: ranked rows with a share for the bar behind them
- [x] `projects`: the cards, ordered by `compareForDashboard`
- [x] `attention`: the queues, with `pendingLeaveRequestCount` **null unless the caller may review
      one**, because only an Admin can approve or reject and showing the number to a PM offers work
      they cannot do
- [x] `myDay`: timer, today, this week, own trend, standup state. **Null for a PM or admin**, who
      track no time, so an empty timer card never implies a control they lack
- [x] `QueryDashboardDto.days`, bounded 7 to 90, because the delta reads a second window of equal
      length and an unbounded range would read years of time entries to draw one chart

### The card carries what the design asks for

Status, who is working on it, blockers, and progress, all on one card:

- [x] Status, priority and types as display objects
- [x] `deadlineLabel` in words, resolved on the **server** clock, which is the clock
      `daysUntilDeadline` was computed on. A browser three hours off would disagree with the number
      beside it
- [x] `isAtRisk`: one definition of overdue-or-blocked, so a card, a count and a filter cannot
      disagree. A finished project is never at risk even with a stale blocker
- [x] `openBlockerCount` and `highSeverityBlockerCount`, so a card says "1 high" without receiving
      every blocker row to count them
- [x] `hoursUsedRate`, above 1 when the estimate is exceeded, null without an estimate
- [x] `minutesInRange` and `lastWorkedAt`
- [x] `members`, project managers first then by name, avatars included so a card does not fetch its
      own team: one request per card, on a screen whose whole job is to load at once
- [x] `DashboardClientProjectDto` is a **separate class**, not a subset. Omitting fields at runtime
      from the wider one is how an internal number reaches a client the first time someone edits it

### Done

- [x] `VIEW_DASHBOARD` in `prisma/enums.prisma`, granted to `EVERYONE` in `ROLE_PERMISSIONS`
- [x] Migration hand written and applied with `prisma migrate deploy`, because `migrate dev` needs a TTY
- [x] `DASHBOARD_AUDIENCE_DISPLAY` in `enum-display.util.ts`. Every tone is `default`: an audience is
      not a severity
- [x] `EnumDisplayEntry` exported, so a consumer can accept "any display map" without widening `tone`
      to `string` and losing the closed five-tone union
- [x] `dto/dashboard.dto.ts`, Response then Query then Request, with an example on every field
- [x] `dashboard.mapper.ts`, pure. Reuses `daysUntilDeadline`, `TERMINAL_STATUSES`,
      `withRemainingHours`, `DASHBOARD_ACTIVE_STATUSES` and `WEEKLY_OFF_DAY` rather than
      reimplementing them
- [x] `spec/dashboard.mapper.spec.ts`, **81 cases**. Audience resolution and the capability rules are
      driven from the real `ROLE_PERMISSIONS`, because a role's grants changing is the thing that can
      break them, and a literal list would keep passing while the real answer moved
- [x] Backend gate green: lint clean, typecheck 0, **1,181 tests**, build succeeds

### Built, and verified against the running stack

The endpoint exists, the screen renders it, and every scoping rule was checked by signing in as four
real accounts rather than by reading the code.

- [x] `GET /api/dashboard` returns 200 with the caller's block
- [x] Registered in `src/app.controllers.ts`, and both route specs updated: 29 controllers, 109 routes
- [x] `spec/dashboard.mapper.spec.ts` at **100 cases** (was 88; the overview redesign added the peak,
      attention and week-progress rules)
- [x] Frontend: `types/dashboard.ts`, `lib/api/dashboard.ts`, `hooks/dashboard/use-dashboard.ts`
- [x] `components/common/stats/`: stat card, mini bars, ranked list, breakdown card, hours chart, and
      from the redesign `icon-tile`, `delta-pill`, `donut-chart`, `section-heading`, `tone-palette`
- [x] `components/home/`: project card, my day, attention, standup, workspace view, client view, home view
- [x] All four view states handled. An empty dashboard is the common case on a fresh install, and an
      error on the landing screen is the first thing a new user would see

| Signed in as    | Projects in scope    | `canManage` | `topContributors` | `pendingLeave` | `myDay` |
| --------------- | -------------------- | ----------- | ----------------- | -------------- | ------- |
| ADMIN           | 111 (all)            | all true    | present           | 51             | present |
| PROJECT_MANAGER | 111 (all)            | **2 of 12** | present           | null           | null    |
| DEVELOPER       | **13 (only theirs)** | all false   | null              | null           | present |
| CLIENT          | 12, reduced          | absent      | absent            | absent         | absent  |

The PM row is the rule working: **sees every project, manages only their own.** The CLIENT row
carries exactly six keys per project, so no internal figure exists in the payload to leak.

### Four defects this found

| Found                                                                                                                                        | How                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| I invented `progressPercentage` and `lastWorkedAt`. Neither is a column: `Project Module.md` specifies the first but the schema never got it | The build failed on the Prisma `select`. Progress is now derived from the lifecycle, and `lastWorkedAt` from one grouped query over time entries |
| The comparison window leaked into the response as `previousFrom` and `previousTo`, fields the DTO does not declare                           | Reading the live payload. `whitelist` and `forbidNonWhitelisted` guard request bodies, not responses, so nothing else would have caught it       |
| I claimed `myDay` was null for an admin. An ADMIN holds `TRACK_PROJECT_TIME`, so they get one, and hiding it would hide a control they have  | The live response disagreed with my own comment                                                                                                  |
| `56.083333333333336h of 114h` on screen. An hours sum is a float, and the card rendered the exact value instead of a label                   | Looking at it. Every hours figure now ships with its readable form (ADR 0003)                                                                    |

### Two decisions worth knowing

**Progress is the lifecycle position, not hours used.** A project can burn 90% of its estimate while
still sitting in Planning, and calling that 90% done would be wrong in the most expensive direction.
Hours against estimate ships separately as `hoursUsedRate`, and a card shows both.

**Standup compliance is not project-scoped.** A standup belongs to a person, not a project, so "9 of
72 filed today" is a fact about the team whichever projects the caller can see. Expected counts only
active developers and designers, so a client or a suspended account cannot drag the rate down.

### Still to build

- [x] `dashboard.service.ts`, with the scoped queries and the aggregation
- [x] `dashboard.controller.ts`, one `GET /` gated on `VIEW_DASHBOARD`
- [x] `dashboard.swagger.ts`, one `applyDecorators()` function
- [x] `dashboard.module.ts`, registered in `AppModule.imports`
- [ ] **Registered in `src/app.controllers.ts`**, or neither route spec sees it and both silently
      cover less. Both assert the controller count for this reason
- [ ] `spec/dashboard.service.spec.ts`, Prisma fully mocked, one case per audience plus the scoping
      assertions above
- [ ] Ordering asserted on a fixture that would fail under any other order (Q6, Q7), reusing
      `compareForDashboard` rather than a second comparator
- [ ] `test/openapi.e2e-spec.ts` still green: every 2xx needs a schema

## Phase D3: frontend, the four dashboards (Q1 to Q9)

> **This section was written before D2 landed and it names four dashboards.** There are two, because
> the API answers with two blocks: `WorkspaceDashboardDto` for every internal audience and
> `ClientDashboardDto` for a client. Three internal views would be three layouts of the same shape,
> and the scope difference is already applied by the query. The three items below that name a file per
> role are struck rather than ticked, so nobody goes looking for a file that was decided against.

- [x] `types/dashboard.ts` and `lib/api/dashboard.ts` verified against the live shape
- [x] `hooks/dashboard/use-dashboard.ts`
- [x] `components/home/home-view.tsx`, reading `audience` and rendering one block
- [x] ~~`admin-dashboard.tsx`~~ / ~~`manager-dashboard.tsx`~~ / ~~`staff-dashboard.tsx`~~, all three
      served by `components/home/workspace-dashboard.tsx`
- [x] `components/home/client-dashboard.tsx`
- [x] The landing route is `app/(app)/page.tsx`, not `app/(dashboard)/dashboard/`, and it is a Server
      Component: it checks the session and renders `<HomeView/>`
- [x] **`dashboard-overview.tsx` is gone**, and a grep for a hardcoded figure under `components/home/`
      and `components/common/stats/` finds none: every number on the screen comes off the response
- [x] Loading, empty and error states on every card. An empty dashboard is the common case on a fresh install
- [x] Tests for the view states per block, and one asserting the list renders in the order it arrived:
      64 Vitest cases across `stats/` and `home/`

### The redesign, from the two UI references

Design taken from the references; the information architecture and the reading order are unchanged.

- [x] One shared kit, so no card declares its own tinted surface: `IconTile`, `DeltaPill`,
      `SectionHeading`, `DonutChart`, and `tone-palette.ts` as the single tone-to-chart-colour map
- [x] The hours chart writes `valueLabel` above each bar and fills the peak solid against a pale tint
- [x] Projects by status is a ring with the total in its centre; blockers by severity keeps the bar
- [x] Standup compliance is a gauge, and draws nothing at all when `rate` is null
- [x] Three derivations left the browser, each replaced by a field: `MiniBars`' `Math.max` (now
      `isPeak`), `MyDayCard`'s week-share division (now `weekProgressRate` and `weekTargetLabel`), and
      `AttentionCard`'s row list, label map and urgency judgment (now `attention.items`)
- [x] **A status board for the projects section is deliberately NOT built, and does not need to be.**
      Ten project statuses do not make four columns, so it would need a coarser lifecycle stage, and
      inventing one is a product decision rather than a design one. It is also already answered
      elsewhere: #20's `components/projects/projects-board.tsx` gives the Projects screen a board
      whose columns are project managers, on the stated grounds that status is already a filter and a
      badge while "who is carrying how much" is the question a board answers. The overview adopts the
      reference's card and column-heading language and links to that screen; it does not grow a second
      board with a third grouping

### D3 revision: the board leads, and everything else shrinks

Plan and reasoning in [`05-overview-redesign.md`](./05-overview-redesign.md).

- [x] `ProjectPhase`: ten statuses grouped into four board lanes, in `src/projects/project-phase.ts`,
      with `spec/project-phase.spec.ts` asserting every `ProjectStatus` lands in exactly one lane
- [x] `?phase=` on `/projects` and `/projects/mine`, intersecting with `?status=` rather than one
      winning. Verified live: the four lane totals (28/30/30/18) match the filtered list exactly
- [x] `projectBoard` on `WorkspaceDashboardDto`, replacing the flat `projects` slice. Cards are taken
      PER COLUMN, since a global limit of twelve left the Closed lane empty on a real workspace
- [x] A column header carries the phase's true total, from the grouped status count, not the number of
      cards under it
- [x] `description` and `isTerminal` on the dashboard card. The mapper already computed `isTerminal`
      and discarded it, so the board printed "93 days overdue" under a CANCELLED project
- [x] Permission gates in the backend for `blockerBreakdown`, `topProjectsByHours`,
      `standupComplianceToday` and the `hoursLogged` and `openBlockers` tiles. Absent, never empty
- [x] `atRisk` counts every at-risk project in scope. It counted the twelve-card slice, so an admin
      with 78 at-risk projects was told 12
- [x] `components/home/project-board.tsx` and `project-board-card.tsx`, replacing `project-card.tsx`
- [x] `lib/config/deep-links.ts`: one registry of destination, permission gate, and whether the route
      exists. `attention-card.tsx` had three links to unwritten routes; the page now has none, checked
      by a spec rather than by eye
- [x] Board columns fill the width and scroll only when they cannot
- [x] One four-column grid for the whole page, cards spanning within it. Every row matches top and
      bottom, and no row contains a hole: reached by shrinking content (`aspect-video` off the chart,
      the status legend collapsed after five, two sparklines dropped), not by alignment tricks
- [x] The at-risk card tint is gone: it read as a priority colour, not a risk one
- [x] Board cards are taller, with an always-rendered description slot so a card with no description
      is not two thirds the height of the one beside it
- [x] Avatar stack keeps its overlap. The cropping was a `overflow-hidden` wrapper clipping the last
      face, not the overlap
- [x] Frontend suite 483 green, lint 0 errors, tsc clean, contrast gate green, both builds green
- [ ] `/projects/[id]`, which every board card links to, is still not built. Pre-existing: the
      projects list, board and timeline all link there too

---

## Phase D4: backend, the contract gaps

### A plain English explanation on every status (E3)

- [ ] Add `description` to `EnumDisplayEntry` in `src/common/utils/enum-display.util.ts`
- [ ] Add `description` to `EnumDisplayDto`. A contract change every consumer sees, so its own PR
- [ ] One sentence for each of the ten project statuses
- [ ] One sentence for each of the five priorities
- [ ] Confirm the build fails until every member of every `Record<TheEnum, EnumDisplayEntry>` has one

### A readiness block on the project response (D3)

- [ ] `{ hasProjectManager, hasDeveloperOrDesigner, isReadyToLeavePlanning, blocking: [{ code, message }] }`
- [ ] Spec: the block agrees with the transition guard in every case, so the screen cannot promise something the guard refuses

---

## Phase D5: projects, list to detail

Four PRs, strictly ordered. PR 3 is a pure move: if its diff shows logic changes, it is wrong.

### PR 1, the list, the board and the timeline

The screen the user asked for is three readings of one query, not a table. `?view=` selects the
reading and `?zoom=` the timeline's scale, both in the URL, so a filtered board is a shareable link.

- [x] `types/projects.ts` · `lib/api/projects.ts` · `hooks/projects/use-projects.ts` with its key factory
- [x] `projects-view.tsx` owns the query · `-filters.tsx` · `-view-switch.tsx`
- [x] `projects-list.tsx`, rows grouped under the manager carrying them
- [x] `projects-board.tsx`, one column per manager. Not draggable: moving a card would reassign a
      project, which is a membership change with its own permission and its own audit entry
- [x] `projects-timeline.tsx`, a Gantt at Day, Week, Month and Quarter zoom (S1, S3)
- [x] `timeline-scale.ts`, the geometry as a pure unit, with 28 specs
- [x] `group-by-lead.ts`, grouping that never re-sorts what the server ordered, with 6 specs
- [x] Filters, sort and paging are query params through `useTableState`, never array methods
- [x] Status and priority through `EnumBadge` (E1, D5)
- [x] Hours spent and remaining against the estimate, straight off the response (D7, D8)
- [x] Every three views share one pager, so the page is the unit of attention in all of them
- [x] Every role reaches the screen. `VIEW_ALL_PROJECTS` reads `/projects`;
      `VIEW_PROJECT_MEMBERS` without it reads `/projects/mine`; neither is a CLIENT and reads the
      same endpoint's reduced shape. Gated on permissions, never a role string (D2)
- [x] `client-projects-list.tsx` is its OWN component reading its OWN `ClientProject` type, not the
      internal list with fields missing. Nine fields, no priority, no team, no hours, no overdue
      verdict, and no board or timeline (both group by the manager carrying the work)
- [x] The scope is part of the query key, so an admin's hundred projects cannot be served from cache
      to the developer who signs in after them
- [x] Tests: 64 across the three views and the scope discriminator, mutation-checked against six
      deliberate breakages including both directions of the scoping bug
- [ ] Row actions gated from each row's own `capabilities`, never from a role. **Not in this PR:**
      there are no row actions yet, because every mutation they would offer belongs to PR 2 and PR 4
- [ ] "New project" in the header. **Not in this PR:** it needs the create form from PR 2, and a
      button that goes nowhere is worse than no button

### PR 1's backend half

The list could not group by manager until the response said who that was, and it could not print an
hours figure until the response phrased one.

- [x] `members` and `lead` on `ProjectResponseDto`. `lead` is the first staffed project manager by
      name, so two clients cannot disagree about which of several managers is "the" one
- [x] `PROJECT_INCLUDE` returns `leftAt`, so the **mapper** enforces current-team-only. A former
      member on a row claims they are working on something they left
- [x] `actualHoursLabel`, `estimatedHoursLabel`, `remainingHoursLabel` and `deadlineLabel`, beside
      the exact figures they read out (ADR 0003). Rendering the number itself puts
      `56.083333333333336h` on a screen, which it did once
- [x] `formatHoursLabel` and `formatDeadlineLabel` moved to `common/utils/duration.util.ts`, so the
      dashboard and the list phrase the same fact identically
- [x] `toProjectMemberSummaries` called once per project rather than twice
- [x] Specs: 22 in `projects/spec/project-lead.spec.ts`, 14 more on the two formatters
- [x] `/projects/mine` accepts the same filters and sort as `/projects`. It took only paging before,
      so the screen offered a developer filter controls that did nothing, and filtering in the
      browser would have filtered the one page it held
- [x] `buildProjectFilters` is shared by both list endpoints, so one of them cannot quietly stop
      honouring `archived` and show an archive to somebody who asked for live work
- [x] `sortBy` is optional on `/projects/mine`, and absent means `compareForDashboard`: priority,
      then deadline, then planned start. That is the order the work should be picked up in, and a
      column sort is the exception rather than the default

### PR 2, create (C1 to C4)

- [ ] `project-form.tsx`, React Hook Form plus Zod mirroring the DTO
- [ ] Name, client and at least one project type required (C2)
- [ ] All seven project types, multi-select (C3)
- [ ] Description, start date and deadline optional (C4)
- [ ] Tests: every required-field rule, and one asserting the backend's 400 surfaces through `humaneError`

### PR 3, the split, no behaviour change

- [ ] `project-detail-shell.tsx` plus `entity-tabs`
- [ ] One file per tab, moved verbatim
- [ ] **`project-detail-view.tsx` deleted**, and no file over 400 lines
- [ ] Confirmed by review that the diff contains no logic changes

### PR 4 onward, one tab per PR

- [ ] **Overview**: the readiness checklist (D3), hours against estimate (D7, D8), the status explanation (E3), archive (E13)
- [ ] **Team**: assign (D1), the workload warning the members endpoint returns (D2, C7), former members shown separately (D4), several of each role (D11)
- [ ] **Team**: a new member sees the full history but cannot modify historical records (D13)
- [ ] **Status**: the fixed route with no skipping (E2), who may advance (E4), Admin-only cancel (E5)
- [ ] **Status**: On Hold and Cancelled capture a reason through `ReasonDialog` (E6)
- [ ] **Status**: reopen, if X3 resolved to add it (E12)
- [ ] **Documents**: upload a file or type text (F1, F2), all six types
- [ ] **Documents**: a credential is typed text only (F5), and a file shows its type, size and format (F6)
- [ ] **Documents**: soft delete is hidden rather than destroyed (F4)
- [ ] **Documents**: the client's reduced view, per X2 (F7)
- [ ] **Priority**: Low to Critical, and Urgent or Critical forces a reason (D5, D6)
- [ ] **Estimated hours**: set and edit (D7)
- [ ] **Activity**: moved onto the shared `Timeline` (D9)
- [ ] **Reports**: the existing project report endpoint (R1)
- [ ] **Slack**: connected state, link, and re-send an invite (N1 to N4)
- [ ] Tests per tab: four view states plus every form rule
- [ ] Handover view: a reassigned developer lands on history, logs and assets (D14)

---

## Phase D6: time tracking and standups

### The global timer (G1 to G6)

- [ ] `components/time/active-timer.tsx`, **mounted at the shell, not per page**. One active timer per person is a global fact, and a page-level mount loses it on navigation
- [ ] Start, pause, resume, stop (G2 to G4)
- [ ] A note explaining what the time was spent on (G5)
- [ ] Start is gated from the project's capability flag, so only an assigned Developer or Designer sees it (G1)
- [ ] The one-timer rule surfaces as a clear message, never as a raw 409 (G6)
- [ ] Tests: every state transition, and the refusal path

### The rest of time tracking

- [ ] Who is working right now, and on what (G7)
- [ ] Totals per project, per day and across all projects (G8)
- [ ] The meeting timer, separate from project time (G10)
- [ ] Clients reach none of it (G9)

### Standups and wrap-ups (H1 to H7)

- [x] Module kit, named for the UI's word rather than the table's: `types/standups.ts` ·
      `lib/api/standups.ts` · `hooks/standups/use-standups.ts`
- [x] The read screen: cards, not a table. A standup is prose, and a cell truncates the plan and the
      wrap-up, which are the only things worth reading
- [x] **A manager asking for nobody now gets the WHOLE TEAM.** It defaulted to the caller, and a
      manager files no standups, so the one screen that exists to read everyone else's was empty with
      no way to ask for everyone. A developer or designer still gets their own, because
      `VIEW_WORK_REPORTS` is held by every delivery role and cannot separate the two
- [x] The list query includes the author, so a team wide list is not a list of ids, and orders by date
      then name so one day sits together
- [x] The mapper stops spreading the raw author row, the same latent defect fixed in leave and audit
- [x] Both halves of a day are always shown and labelled with why they are empty. A day can have a
      plan and no wrap-up (in progress) or a wrap-up and no plan (somebody forgot the morning), and
      hiding the absent half makes those two states look identical
- [x] Filters by date range and entry type (H6)
- [ ] The plan form: one submission covering all of a person's projects for the day (H1, H3)
- [ ] The wrap-up form, on the same projects (H2)
- [ ] Today's state visible at a glance, so a person knows what they still owe (H4)
- [ ] The PM review queue, with a comment per entry (H5)
- [ ] Scoped so a PM sees only entries for projects they manage (H7)
- [ ] Tests: four view states, the multi-project submit, and the review comment asserted on the value sent

### Exit criteria, D6

- [ ] A developer can run a full day through the tool: timer, standup, pause, resume, wrap-up, stop
- [ ] A PM can read and comment on every entry they own

---

## Phase D7: blockers, requirements, reviews and feedback

### Blockers (I1 to I13)

- [x] Module recipe: types, client, hook with key factory
- [x] The cross-project list with filters by status, severity and a description search (I11).
      `GET /blockers` gained `search`: a blocker is found by what it says, because nobody remembers
      which project a half recalled problem belonged to
- [x] The staff scope is the backend's: a DEVELOPER or DESIGNER sees only blockers on projects they
      are an active member of, and the scope clause sits LAST in the where so no filter can spread
      over it
- [ ] Report a blocker, severity and a reason from the list (I1 to I3)
- [ ] The reason list admin screen (I4)
- [ ] Open, In Progress, Resolved (I5), assignment (I6), days open (I7)
- [ ] Resolution notes (I8) and deadline impact days (I9)
- [ ] The per-project deadline impact screen the endpoint already serves (I10)
- [ ] Blockers surface to the PM (I13)
- [x] Clients reach none of it (I12). They hold no `VIEW_BLOCKERS`, so the nav row is absent and
      the route answers 403
- [~] Tests: the four view states are covered; **the form rules are not**, because reporting a
  blocker is a mutation and lands with the rest of them

### Additional requirements (J1 to J8)

- [ ] Module recipe
- [ ] The PM inbox, with out of scope items visible (J7)
- [ ] Create with a source channel (J1, J2)
- [ ] Approve or reject (J3), with extra hours and the days the deadline moves (J4)
- [ ] The permanent record of who approved it and when (J5)
- [ ] Tests

### Internal reviews (K1 to K6)

- [ ] Module recipe
- [ ] Submit a round: decision plus comments (K2)
- [ ] The round history, so a second round reads against the first (K3, K6)
- [ ] Pass moves to Ready For Client, changes required moves to Ready For Work (K4, K5)
- [ ] A Developer or Designer submits the project into Internal Review (K1)
- [ ] Tests

### Client feedback (L4 to L8)

- [ ] Module recipe
- [ ] The client's own Approved or Changes Requested action (L4)
- [ ] The PM recording it on the client's behalf (L5)
- [ ] The round history with its incrementing round number (L6)
- [ ] Tests

### Shared

- [ ] Every written reason in this phase goes through the same `ReasonDialog`
- [ ] Every round-based history renders through the same `Timeline`

---

## Phase D8: people, leave, notifications, audit and the client portal

### People (B4 to B9, D14)

- [ ] Profile: view and update, with a photo (B4)
- [ ] Work status: sick, casual, WFH, onsite (B6)
- [ ] Availability: ready or occupied (B7)
- [ ] How many and which projects each developer is on (B8)
- [~] Users admin (B1, B9). **The list is done**, filtered by role, status and one search box over
  name OR email, sorted by name, email or join date. Invite, edit and delete are mutations and
  land separately
- [x] `GET /users` gained `role`, `status` and `search`. It took only `sortBy` and `sortOrder`, so
      the screen had no way to answer "who are the designers" except by paging 235 people
- [ ] An Admin opens any person's record (B5)
- [ ] Tests

### Leave (M1 to M8)

- [~] Module recipe. **Requests are done**; the clients for types, holidays and balances land with
  their own screens
- [ ] Request leave, including as an Admin. Clients cannot (M1)
- [ ] Own remaining balance (M4)
- [ ] Cancel your own pending request (M7)
- [ ] The leave types admin screen (M2)
- [ ] The public holiday calendar admin screen (M3)
- [~] The PM's queue (M5). **The queue is done** and opens on Pending, because a reviewer comes here
  to answer "what is waiting". The approve and reject controls are not built yet, so there is
  nothing to hide from a PM; when they are, they gate on each row's own `capabilities.canApprove`
- [x] `GET /leave/requests` gained `status` and `leaveTypeId`. A review queue without a status filter
      is 420 requests of which most are already decided
- [x] **The status filter NARROWS what a role may see, never widens it.** A PROJECT_MANAGER is
      restricted to PENDING and APPROVED, and the filter is intersected with that rather than spread
      over it: `?status=REJECTED` would otherwise have handed them exactly the rows the rule
      withholds. Three specs pin it, and a mutation putting the spread back fails all three
- [ ] The Admin's approve and reject (M6)
- [ ] The summary and its CSV export (M8)
- [ ] Tests, including one asserting a PM is shown no approve control

### Notifications (O1, O2)

Landed early, out of phase order, because the user's header redesign needed real rows behind it. The
spec and the reasoning are in [`03-header-chrome.md`](./03-header-chrome.md).

- [x] `types/notifications.ts` · `lib/api/notifications.ts` · `hooks/notifications/`
- [x] A bell with an unread count in the site header
- [x] The inbox: mark one read, mark all read. In the header's popover and its activity sheet, **not**
      on a page of its own: a notifications SCREEN is still open
- [x] Tests: 48 cases across the api client, the hooks, the row, the bell and the sheet
- [ ] A notifications page, if this product wants one. The two header panels cover O1 and O2 today

### What the reviewers found on the queues PR

Security review: clean. No critical, high or medium findings. All three deliberate authorization
changes were verified reachable-by-request and correct, including that `/leave/requests/me`,
`/summary` and `/summary/export` cannot route around the status intersection.

Code review and frontend review found six things worth fixing, all fixed:

- [x] **`reviewedBy` was never fetched.** Six leave queries each wrote `include: { leaveType: true }`
      and none asked for the relation, so 286 approved requests reported a `reviewedAt` with a null
      reviewer and the queue's "Decided by" column was a date with no name. The mapper was correct all
      along; nothing fed it. There is now ONE `LEAVE_REQUEST_INCLUDE`, and a spec asserts the wiring
      rather than only the mapper: a mapper spec builds its own fixture, so it proves the mapper
      handles a relation and says nothing about whether the relation ever arrives
- [x] **Three of the four new filters shipped untested.** `users` (role, status, search), `blockers`
      (search plus the staff scope clause) and `audit-logs` (action and both date bounds) now assert
      the WHERE clause a mock was called with, and the day boundary helpers have their own spec
- [x] **`CRITICAL` is not a `BlockerSeverity`.** The severity filter offered a fourth member copied
      from `ProjectPriority`, so selecting it sent a value `@IsEnum` answers 400 for: the control
      looked available and broke the screen. The options moved to their own module so a spec can pin
      them against the enum
- [x] `@IsSearchTerm()` and `@ToArray()` replace four and three copies of the same decorator stacks
- [x] `leaveTypeId` is `@IsUUID()` and `userId` is length bounded, matching their create-side siblings
- [x] `startOfUtcDay` / `endOfUtcDay` moved to `common/utils/date.util.ts`, the fifth day boundary
      helper in this codebase and the first with a spec
- [x] `listErrorDescription` replaces the `error instanceof Error` ternary in six list views. The
      guard is the part that must not diverge: TanStack types `error` as `unknown`, so a copy reaching
      for `.message` renders "undefined" on a non-Error rejection
- [x] `time-entry.mapper.ts` stops spreading its author row. Not leaking today, but that is a property
      of a `select` elsewhere rather than of the mapper

### Audit log (P1)

- [x] The screen, on the module recipe: types, client, hook with a key factory, columns, list view
- [x] `GET /audit-logs` gained `action`, `startDate` and `endDate`. An audit log without a date range
      is unusable at any real size, and `endDate` reads to the END of the day it names
- [x] **The module had no mapper**, so `paginate()`'s result went out untouched: `action` reached the
      screen as the raw `user.password_changed` and the actor row went out whole. It has one now, and
      it maps field by field rather than spreading
- [x] `actionLabel`, DERIVED from the action rather than looked up. The vocabulary is deliberately
      open (the DTO says so), so a lookup table would render a blank cell for whichever new action
      nobody remembered to add, and it would be blank for exactly the event worth auditing
- [x] `targetType` and `targetId` are nullable in the schema and the DTO claimed they were required.
      A system action with no row behind it now renders as "System"
- [x] Tests: 23 backend, plus the queue's own cases

### The client portal (L1 to L3, L9, L10)

- [ ] Own projects only, never anyone else's (L2)
- [ ] Status and deadline, and nothing else (L3)
- [ ] Deliverable documents, per X2 (L10)
- [ ] A notice when a project's status changes (L9)
- [ ] Tests, including one asserting no internal field reaches a client view

### Exit criteria, D8

- [ ] Sign in as each of the six roles and reach every screen that role should have, and none it should not

---

## Phase D9: the AI module

### Frontend for what the backend already serves

- [ ] `types/ai.ts` · `lib/api/ai-templates.ts` · `ai-jobs.ts` · `project-summary.ts` · `status-reports.ts` · hooks for each
- [ ] Templates CRUD, two kinds, staff readable and Admin writable (R3)
- [ ] Only one template of each kind can be the default, enforced visibly (R3)
- [ ] The scope check request, and **it is never automatic**: a PM asks for it explicitly (R4)
- [ ] The verdict panel: in scope, out of scope or unclear, with confidence and the written reason (R5)
- [ ] The suggested extra hours shown as a suggestion, with the PM's own number the one that is stored (R6)
- [ ] A re-run replaces the previous answer, and the UI does not imply a history (R7)
- [ ] **Approve and reject work regardless of what the scope check said** (R6). This is the rule that matters most to get right
- [ ] A project with no PRD or Requirement documents still shows the recorded explanation, never an error (R5)
- [ ] The live project summary: immediate, and **nothing in the UI implies it is saved** (R8)
- [ ] The status report generator, with the period defaulting to since the last report or the last seven days (R11)
- [ ] The status report history, never overwritten (R10)
- [ ] Job polling for the two background features (R13)
- [ ] Tests: the four view states, the polling states, and one asserting approve is enabled with an out of scope verdict

### Backend additions

- [ ] AI hours estimate (C6, R15), offered at creation and re-runnable, with the PM's value always the stored one (X5)
- [ ] AI PRD generation (R14)
- [ ] Sprint progress report (R16)
- [ ] Project delivery report (R16)
- [ ] Team workload report (R16)
- [ ] Service specs for each, including the no-source-documents path
- [ ] Swagger published for each

### Frontend for the additions

- [ ] The estimate offered at creation, and re-runnable from the project (C6)
- [ ] PRD generation from the documents tab (R14)
- [ ] The three new reports on the reports surface (R16)

---

## Phase D10: the named gaps

### Timeline and Gantt (S1, S3, S4)

**S1 and S3 landed early, in D5 PR 1**, because the projects screen the user specified is a timeline
as much as it is a list, and building the list twice to keep the phases tidy would have been the
worse trade.

- [~] The project timeline screen (S1), at four zoom levels. **Partial:** it groups by project
  manager, which is what the supplied screens show. `features1` asks for it per developer, which
  is a merge rather than a group because one developer works under several managers. That axis
  and S4 are the same piece of work
- [x] The overlap view (S3). The same screen answers it: bars on a shared axis grouped by manager
      show two overlapping projects under one person, which no table can
- [ ] ~~A timeline endpoint returning already-laid-out bars per member~~ **Reconsidered.** A bar's
      offset is a percentage of a window that changes with the zoom and the viewport, so a native
      client would need different numbers from the same facts: that is the test D4 sets, and layout
      fails it. The endpoint would have to be re-requested on every zoom click. What the backend owes
      the view is dates, and it already sends them. `timeline-scale.ts` holds the geometry as a pure
      unit with 28 specs, which is where the testability the endpoint was for actually comes from
- [ ] A per-week workload endpoint (S4). Still a real gap, and genuinely a backend one: a person's
      committed hours per week is a figure, not a layout
- [ ] Its spec

### Exports (T1, T3, T4, S2, R17)

- [ ] CSV for project lists (T1)
- [ ] CSV for blockers (T4)
- [ ] CSV for time data (T4)
- [ ] PDF for a report (T3, R17)
- [ ] PDF for the timeline (S2)
- [ ] Follow the existing leave summary export: it already sets `text/csv` and a `Content-Disposition` filename
- [ ] Wire `ExportButton` from D1 into every list that has an export

### Documents

- [ ] Version history: a row per upload, with the current version resolved server side (F8)
- [ ] A `CONTRACT` document type (F9)
- [ ] The version history UI on the documents tab
- [ ] Specs

### Reopening a closed project (E12, X3)

- [ ] Admin only, a required reason, recorded as a `ProjectActivity`
- [ ] The UI action, through `ReasonDialog`
- [ ] Specs, including that no lower role can reach it

### The working window and the crons

- [ ] Count only 9am to 6pm, Saturday to Thursday on a time entry (G12), using `src/common/working-day/`
- [ ] Service specs on the boundary cases **before this touches real data**: a timer started at 5:55pm, a timer spanning a Friday, a timer started before 9am
- [ ] A cron that closes a timer left running past the working day (G13, U4)
- [ ] An auto-closed entry is visibly marked as auto-closed
- [ ] A dry run that logs what it would change, before it changes anything
- [ ] A cron that promotes a Scheduled project to Ready For Work when its planned start date arrives (E9, U3)
- [ ] Specs for both crons, including the timezone. The existing three use `Asia/Dhaka`

### A revision checklist on a review round (K7)

- [ ] Revision items against a `ProjectInternalReview`, each markable done
- [ ] The UI on the reviews tab
- [ ] Specs

### Scheduled reports (U5)

- [ ] Depends on exports landing. Last item in the plan, and the first candidate to drop if time runs short

---

## Phase D11: hardening and close

- [ ] Design token ESLint group flipped from `warn` to `error`
- [ ] Dependency direction group flipped to `error`
- [ ] Presentation only group flipped to `error`
- [ ] Playwright, one journey per role, storage-state auth, under `pmt-frontend/e2e/tests/`
- [ ] No component over 400 lines, verified by a line count over `components/`
- [ ] No `useEffect` plus `fetch` remaining, verified by grep
- [ ] No `.sort(`, `.reduce(` or `.filter(` under `components/`, verified by the lint group at `error`
- [ ] `lib/api/client.ts` deleted once nothing imports it
- [ ] `pnpm lint` green, both packages
- [ ] `pnpm typecheck` green, both packages
- [ ] `pnpm test` green, both packages
- [ ] `pnpm test:e2e` green, both suites
- [ ] `pnpm build` green, both packages
- [ ] `pmt-frontend/CLAUDE.md` updated
- [ ] `docs/refactor/02-checklist.md` and `03-progress.md` updated, and refactor Phase 8 marked as absorbed by this plan
- [ ] ADRs written for the dashboard's audience discriminator and for every conflict resolved by judgment rather than by a document

---

## The rule this checklist runs under

Before the security review and the code review in any phase, **ask**. Say what would be run and on
what diff, and wait. Then do exactly what is instructed, and say in the report which reviews ran and
which were declined. That applies however large the change and however obviously a review looks
warranted: spending a review is the user's call.

Security review is mandatory to offer for anything touching auth, permissions, ownership scoping,
uploads, Slack, AI or an anonymous route. In this plan that is D2 (a new permission), D5 (documents and
ownership scoping), D8 (the client portal and the PM's read-only leave queue), D9 (AI) and D10
(exports and reopening).
