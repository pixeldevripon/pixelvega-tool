# Daily Work Report & Real-Time Blockers Implementation Checklist

**Status**: Both phases shipped, merged to `main`
**Version**: 1.0 (As-built)

This checklist now records what was actually built, not a pending plan. See `DESIGN.md` §12 for the full list of deltas from the original pre-build design.

---

## Phase 1: Daily Work Reports

**Built flat inside the existing `src/modules/projects/`, not a standalone `src/modules/daily-work-reports/`** — same DI reasoning as Blockers below (Phase 2's deviation note), discovered by hitting a duplicate `ProjectActivityService` instance after building this standalone first, then merging it in.

### A. Database & Migrations

- [x] `DailyWorkReport` model (`status` defaults to `PLAN_SUBMITTED`, not `DRAFT` — `DRAFT` exists in the enum but `create()` never produces it)
- [x] `DailyProjectEntry` model (no blocker fields — blockers were deliberately never added here)
- [x] `DailyWorkReportStatus` enum (`DRAFT`, `PLAN_SUBMITTED`, `COMPLETED`)
- [x] `ProjectActivityType` includes `PLAN_SUBMITTED`, `PLAN_UPDATED`, `WRAP_UP_SUBMITTED`, `WRAP_UP_UPDATED`, `WORK_REPORT_REVIEWED`

### B. Service Layer

#### `DailyWorkReportService` (`src/modules/projects/daily-work-report.service.ts`)

- [x] `create(userId, dto)` — validates project membership, creates report (`PLAN_SUBMITTED`) + entries, logs `PLAN_SUBMITTED` per project, posts to Slack (fire-and-forget)
- [x] `updatePlan(reportId, userId, dto)` — state-based lock: 409 once wrap-up is submitted, no time limit before that
- [x] `findByUserAndDate(userId, date)` — today's report
- [x] `findAllForUser(actorId, actorRole, query)` — self-scoped for DEVELOPER/DESIGNER (403 on someone else's `userId`), any-user for PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN; `startDate`/`endDate`/`type` filters
- [x] `submitWrapUp(reportId, userId, dto)` — 409 unless plan already submitted; upserts per project (updates existing entry, creates new for unplanned work); sets `COMPLETED` + `wrapUpSubmittedAt`; posts to Slack
- [x] `updateWrapUp(reportId, userId, dto)` — time-based lock: 409 past 2 hours after `wrapUpSubmittedAt`
- [x] `findByProject(projectId, query, actorId, actorRole)` — the project-nested read (see Controllers below); company-wide for PM/Admin, active-member-only for DEVELOPER/DESIGNER

#### `DailyProjectEntryService` (`src/modules/projects/daily-project-entry.service.ts`)

- [x] `review(entryId, dto, actorId, actorRole)` — PM-of-project (or ADMIN/SYSTEM_ADMIN) only, 409 unless the report is `COMPLETED`, logs `WORK_REPORT_REVIEWED`

### C. DTOs (`src/modules/projects/dto/`)

- [x] `submit-plan.dto.ts` — `SubmitPlanDto { entries: DailyProjectEntryPlanDto[] }`
- [x] `update-plan.dto.ts` — `UpdatePlanDto`
- [x] `submit-wrap-up.dto.ts` — `SubmitWrapUpDto { entries: DailyProjectEntryWrapUpDto[] }`
- [x] `update-wrap-up.dto.ts` — `UpdateWrapUpDto`
- [x] `review-entry.dto.ts` — `ReviewEntryDto { reviewComment? }`
- [x] `query-daily-work-reports.dto.ts` — `userId?`, `startDate?`, `endDate?`, `type?: 'PLAN' | 'WRAP_UP'`, pagination
- [x] `query-project-daily-entries.dto.ts` — same filters, project-nested
- [x] No separate response DTO classes — the service returns the Prisma payload directly (with `entries`/`project`/`reviewedBy` includes), matching the convention elsewhere in this module

### D. Controllers & Routes

**`DailyWorkReportController`** (`@Controller('daily-work-reports')`, `src/modules/projects/daily-work-report.controller.ts`)

- [x] `POST /api/daily-work-reports` → `submitPlan()` — `@Roles([DEVELOPER, DESIGNER])`
- [x] `PATCH /api/daily-work-reports/:id/plan` → `updatePlan()`
- [x] `GET /api/daily-work-reports/today` → `getTodayReport()`
- [x] `GET /api/daily-work-reports` → `findAll()` — `@Roles([DEVELOPER, DESIGNER, PROJECT_MANAGER])`, self-vs-staff gating in the service *(not in the original checklist — added because cross-project self/team history is a distinct, real question)*
- [x] `POST /api/daily-work-reports/:id/wrap-up` → `submitWrapUp()`
- [x] `PATCH /api/daily-work-reports/:id/wrap-up` → `updateWrapUp()`
- [x] `PATCH /api/daily-work-reports/:reportId/entries/:entryId/review` → `reviewEntry()` — `@Roles([PROJECT_MANAGER])`

**`ProjectDailyWorkReportsController`** (`@Controller('projects/:projectId/daily-work-reports')`) *(not in the original checklist)*

- [x] `GET /api/projects/:projectId/daily-work-reports` → `findByProject()` — mirrors the `TimeEntriesController`/`ProjectTimeEntriesController` split elsewhere in this module

### E. Module Setup

- [x] No standalone module — registered directly in the existing `ProjectsModule` (`src/modules/projects/projects.module.ts`), same reasoning as Blockers (Phase 2)

### F. Error Handling & Validation

- [x] 400 — invalid DTO, empty entries array
- [x] 403 — not an active `ProjectMember` on a listed project; viewing another user's reports without PM/Admin access
- [x] 404 — report/entry/project not found
- [x] 409 — duplicate report for the day; wrap-up before plan; editing plan after wrap-up; editing wrap-up past 2h; reviewing before `COMPLETED`

### G. ProjectActivity Logging

- [x] `PLAN_SUBMITTED`, `PLAN_UPDATED`, `WRAP_UP_SUBMITTED`, `WRAP_UP_UPDATED`, `WORK_REPORT_REVIEWED` — all logged through the shared `ProjectActivityService`

### H. Slack Integration

- [x] Shipped later, as a separate feature (see `docs/features/slack-integration/`) — plan/wrap-up post to the project's channel per entry and to the fixed company-wide feed channel as one combined message per report; editing within the edit window updates both in place

### I. Testing (Unit Tests)

- [ ] Not written — this repo has no unit tests (`*.spec.ts`) anywhere yet (see CLAUDE.md's Testing note)

---

## Phase 2: Real-Time Blockers — INDEPENDENT

**Two deliberate deviations from the original checklist's proposed locations, decided with the user before starting:**
1. **Module location**: lives flat inside `src/modules/projects/` (`blocker.service.ts`, `blockers.controller.ts`, `project-blockers.controller.ts`, `dto/*blocker*`), registered in `ProjectsModule` — not a standalone `src/modules/blockers/`. Same DI reasoning as Daily Work Reports above.
2. **Slack integration was skipped in this phase's original pass** — at the time, this backend had no Slack/notification infrastructure at all. **This has since changed**: Slack integration shipped as its own later feature and Blockers now posts to the project's Slack channel on both report and status change — see Section G below and `docs/features/slack-integration/`.

`User` relations are `reportedBlockers`/`resolvedBlockers` (not `createdBlockers`), matching this codebase's `<verb>ById`/`<verb>By` convention (`uploadedById`, `reviewedById`).

### A. Database & Migrations

- [x] `Blocker` model, `BlockerStatus` (`OPEN`/`IN_PROGRESS`/`RESOLVED`), `BlockerSeverity` (`LOW`/`MEDIUM`/`HIGH`)
- [x] `ProjectActivityType`: `BLOCKER_ADDED`, `BLOCKER_STATUS_CHANGED`
- [x] `Project.blockers`, `User.reportedBlockers`/`resolvedBlockers` relations
- [x] Hand-written migration applied via `prisma migrate deploy` (non-interactive shell, per CLAUDE.md's Prisma note)

### B. Service Layer

#### `BlockerService` (`src/modules/projects/blocker.service.ts`)

- [x] `addBlocker(dto, actorId, actorRole)` — **requires the caller be an active member of the target project** (any role) unless ADMIN/SYSTEM_ADMIN *(tightened after the original design — originally no staffing check existed at all)*; creates with `status: OPEN`; logs `BLOCKER_ADDED`; posts to Slack (fire-and-forget)
- [x] `updateBlocker(blockerId, dto, actorId, actorRole)` — reporter (re-checked for still-active membership) or PM-of-project or ADMIN/SYSTEM_ADMIN; 409 if already `RESOLVED`; forward-only status validation (`OPEN → RESOLVED` directly allowed, skipping `IN_PROGRESS`); `resolutionNotes` required exactly when resolving; logs `BLOCKER_STATUS_CHANGED`; posts to Slack on status change
- [x] `findAll(query, actorId, actorRole)` — company-wide for PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN; **staff-scoped to the caller's active projects for DEVELOPER/DESIGNER** *(tightened after the original design — originally this route was PM/Admin-only)*
- [x] `findByProject(projectId, query, actorId, actorRole)` — company-wide read for PM/Admin, active-member-only for DEVELOPER/DESIGNER
- [x] `withMetrics()` (private) — derives `resolutionTime`/`daysOpen` on read, never stored
- [x] `assertCanUpdate()`/`assertCanReport()`/`assertCanRead()`/`assertManagesProject()`/`assertIsActiveMember()` (private helpers) — no public `canUpdateBlocker()`/`getResolutionTime()` methods as originally sketched; folded into the service's private helpers instead

### C. DTOs (`src/modules/projects/dto/`)

- [x] `add-blocker.dto.ts` — `AddBlockerDto { projectId, description, severity? }`
- [x] `update-blocker.dto.ts` — `UpdateBlockerDto { description?, severity?, status?, resolutionNotes? }`
- [x] `query-blockers.dto.ts` (company-wide: `status`/`severity`/`projectId` + pagination) and `query-project-blockers.dto.ts` (project-nested: `status`/`severity` + pagination) — two DTOs, not one combined
- [x] No separate response DTO class — the service returns the Prisma payload directly (blocker + `project`/`reportedBy`/`resolvedBy` + `resolutionTime`/`daysOpen`)

### D. Controllers & Routes

**`BlockersController`** (`@Controller('blockers')`, top-level — mirrors the `TimeEntriesController`/`ProjectTimeEntriesController` split)

- [x] `POST /api/blockers` → `addBlocker()` — `@Roles([DEVELOPER, DESIGNER, PROJECT_MANAGER])`
- [x] `PATCH /api/blockers/:blockerId` → `updateBlocker()` — same roles
- [x] `GET /api/blockers` → `findAll()` — `@Roles([DEVELOPER, DESIGNER, PROJECT_MANAGER])` *(broadened after the original design, which had this PM/Admin-only — DEVELOPER/DESIGNER now see their own staffed projects' blockers)*

**`ProjectBlockersController`** (`@Controller('projects/:projectId/blockers')`)

- [x] `GET /api/projects/:projectId/blockers` → `findByProject()` — `@Roles([DEVELOPER, DESIGNER, PROJECT_MANAGER])`, staffing-scoped for DEVELOPER/DESIGNER in the service

### E. Module Setup

- [x] No standalone module — registered directly in `ProjectsModule`

### F. Error Handling & Validation

- [x] 400 — invalid DTO; resolution notes missing when resolving (or sent without resolving)
- [x] 403 — reporting/updating without active project membership; updating without being the reporter or PM-of-project
- [x] 404 — blocker/project not found
- [x] 409 — invalid (backward) status transition; editing an already-`RESOLVED` blocker

### G. Slack Integration (Real-Time)

- [x] **Now implemented** — shipped as part of the separate `docs/features/slack-integration/` feature, after this checklist's original Phase 2 pass. `addBlocker()`/`updateBlocker()` post to the project's own Slack channel (never the company-wide feed channel) — one message per event, no `ts` stored (unlike plan/wrap-up, a blocker status change is never edited in place). Silently no-ops if the project has no `slackChannelId`.

### H. ProjectActivity Logging

- [x] `BLOCKER_ADDED`, `BLOCKER_STATUS_CHANGED` — logged on report and status change

### I. Testing (Unit Tests)

- [ ] Not written — this repo has no unit tests (`*.spec.ts`) anywhere yet (see CLAUDE.md's Testing note); Phase 1 shipped the same way

---

## Not Built / No Longer Planned

- Combined dashboards, blocker analytics/trends, resolution SLAs (the original "Phase 3") — never built, not currently planned
- Reminder notifications for a missing daily submission — no notification system exists in this backend
- DM alerts for HIGH-severity blockers — floated in the original design, never built

---

## Success Criteria (final status)

- [x] Dev can submit plan for 1+ projects
- [x] Dev can update plan anytime before wrap-up
- [x] Dev can submit wrap-up after plan (409 if no plan)
- [x] Dev can update wrap-up within 2h window
- [x] PM can review entries (once the report is `COMPLETED`)
- [x] Dev/Designer/PM can report a blocker if actively staffed on that project (or ADMIN/SYSTEM_ADMIN regardless)
- [x] Blocker status transitions work (`OPEN → IN_PROGRESS → RESOLVED`, forward-only)
- [x] Blocker can span multiple days
- [x] All actions logged to `ProjectActivity`
- [x] Real-time Slack alerts for blockers and daily reports — shipped as the separate Slack integration feature
- [x] Appropriate HTTP status codes
- [ ] Unit tests — no unit tests exist in this repo yet, for any feature

---

## Recommended Reading

- `DESIGN.md` §12 — the full list of deltas from the original design
- `docs/features/slack-integration/` — the Slack feature that both of these post to
