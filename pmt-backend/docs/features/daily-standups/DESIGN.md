# Daily Work Report & Real-Time Blockers Feature Design

**Version**: 1.0 (As-built)
**Status**: Implemented and merged to `main`
**Created**: 2026-07-25
**Updated**: 2026-08-01 — rewritten to describe the actual shipped implementation rather than the original pre-build design. See §12 for what changed along the way.

---

## 1. Feature Overview

Two **completely separate** systems, both live in `src/modules/projects/` (see §4 — neither got its own top-level module):

### Daily Work Reports (Developer-Centric)
Developers submit daily plans (morning) and accomplishments (evening wrap-up). One report per person, per calendar day.
- Plan: "What I'll work on today"
- Wrap-Up: "What I actually accomplished"
- Tied to specific date and developer

### Real-Time Blockers (Project-Centric)
Team members report blocking issues in real-time, anytime, across multiple days. Independent lifecycle, not tied to daily reports.
- Created: Anytime a blocker is discovered, by an active member of that project
- Resolved: Anytime (could be days later)
- Tracked: Until RESOLVED (terminal, then locked)
- Not tied to any specific daily report

Both post to Slack — see §7 and `docs/features/slack-integration/DESIGN.md` for the full Slack picture (a separate feature, built afterward).

---

## 2. Database Schema (as implemented)

### Daily Work Report Models

**DailyWorkReport**
```prisma
model DailyWorkReport {
  id     String   @id @default(uuid())
  userId String
  user   User     @relation("WorkReportAuthor", fields: [userId], references: [id])
  date   DateTime @db.Date

  status DailyWorkReportStatus @default(PLAN_SUBMITTED)

  planSubmittedAt   DateTime?
  wrapUpSubmittedAt DateTime?

  // Slack — ts of the ONE combined message per report posted to
  // SLACK_DAILY_FEED_CHANNEL_ID, covering every project entry at once.
  planFeedSlackTs   String?
  wrapUpFeedSlackTs String?

  entries DailyProjectEntry[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, date])
  @@index([userId])
  @@index([date])
}

enum DailyWorkReportStatus {
  DRAFT           // unused in practice — create() always goes straight to PLAN_SUBMITTED; kept for forward compatibility
  PLAN_SUBMITTED
  COMPLETED
}
```

Note the default is `PLAN_SUBMITTED`, not `DRAFT` — a row is only ever created by submitting a plan, so there's no intermediate draft state in practice.

**DailyProjectEntry**
```prisma
model DailyProjectEntry {
  id                String          @id @default(uuid())
  dailyWorkReportId String
  dailyWorkReport   DailyWorkReport @relation(fields: [dailyWorkReportId], references: [id])
  projectId         String
  project           Project         @relation(fields: [projectId], references: [id])

  plan            String? // what I plan to work on
  accomplishments String? // what I actually did

  // Slack — ts of this entry's own message in its project's channel
  planProjectSlackTs   String?
  wrapUpProjectSlackTs String?

  reviewedById  String?
  reviewedBy    User?     @relation("ProjectEntryReviewer", fields: [reviewedById], references: [id])
  reviewedAt    DateTime?
  reviewComment String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([dailyWorkReportId, projectId])
  @@index([projectId])
}
```

There is no `blockers` field here — blockers were deliberately never added to this model (see below).

### Real-Time Blocker Model (INDEPENDENT)

```prisma
model Blocker {
  id          String          @id @default(uuid())
  projectId   String
  project     Project         @relation(fields: [projectId], references: [id])
  description String
  status      BlockerStatus   @default(OPEN)
  severity    BlockerSeverity @default(MEDIUM)

  reportedById String
  reportedBy   User   @relation("BlockerReportedBy", fields: [reportedById], references: [id])

  resolvedById    String?
  resolvedBy      User?     @relation("BlockerResolvedBy", fields: [resolvedById], references: [id])
  resolvedAt      DateTime?
  resolutionNotes String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
  @@index([status])
  @@index([severity])
  @@index([createdAt])
}

enum BlockerStatus {
  OPEN
  IN_PROGRESS
  RESOLVED // terminal — locked, no further edits by anyone
}

enum BlockerSeverity {
  LOW
  MEDIUM
  HIGH
}
```

The `User` relation names are `reportedBlockers`/`resolvedBlockers` (not `createdBlockers` as originally sketched), matching this codebase's `<verb>ById`/`<verb>By` convention elsewhere (`uploadedById`, `reviewedById`). There is no separate resolution-time or days-open column — both are derived on every read (see §6).

### `ProjectActivityType` values these features use

```
PLAN_SUBMITTED
PLAN_UPDATED
WRAP_UP_SUBMITTED
WRAP_UP_UPDATED
WORK_REPORT_REVIEWED
BLOCKER_ADDED
BLOCKER_STATUS_CHANGED
```

---

## 3. API Endpoints (as implemented)

### Daily Work Report Endpoints

**`POST /api/daily-work-reports`** — submit today's plan
- Body: `{ entries: [{ projectId, plan }] }`
- Creates the report (`status: PLAN_SUBMITTED`) plus one `DailyProjectEntry` per project
- 403 if not an active `ProjectMember` on any listed project; 409 if a report already exists for today (`@@unique([userId, date])`)

**`PATCH /api/daily-work-reports/:id/plan`** — update the plan
- Editable anytime **until wrap-up is submitted** — no time limit (state-based lock, not time-based)
- 409 once `status` is `COMPLETED`

**`GET /api/daily-work-reports/today`** — fetch the caller's own report for today

**`GET /api/daily-work-reports`** — list reports across every project the caller has touched
- Self-scoped for `DEVELOPER`/`DESIGNER` (403 if `userId` is set to someone else); `PROJECT_MANAGER`/`ADMIN`/`SYSTEM_ADMIN` may pass `userId` to view any team member
- `startDate`/`endDate` (both inclusive, omit for all time) and `type=PLAN`/`type=WRAP_UP` filters
- *(Not in the original design — added because "show me one person's history across every project" is a real, distinct question from the project-nested list below.)*

**`GET /api/projects/:projectId/daily-work-reports`** — this project's entries across every developer/day
- `PROJECT_MANAGER`/`ADMIN`/`SYSTEM_ADMIN` company-wide; `DEVELOPER`/`DESIGNER` must be an active member of this project
- Same `startDate`/`endDate`/`type` filters as above
- *(Also not in the original design — the project-nested counterpart, mirroring the `TimeEntriesController`/`ProjectTimeEntriesController` split elsewhere in this module.)*

**`POST /api/daily-work-reports/:id/wrap-up`** — submit the wrap-up
- Body: `{ entries: [{ projectId, accomplishments }] }`
- 409 unless `status` is already `PLAN_SUBMITTED` — **plan is mandatory before wrap-up**
- `upsert`s per project: updates an existing entry from the plan, or creates a brand-new entry for a project that wasn't in the morning plan (unplanned/urgent work)
- Sets `status: COMPLETED` and `wrapUpSubmittedAt`

**`PATCH /api/daily-work-reports/:id/wrap-up`** — update the wrap-up
- Editable for a fixed **2 hours** after `wrapUpSubmittedAt` — 409 past that window

**`PATCH /api/daily-work-reports/:reportId/entries/:entryId/review`** — PM reviews one entry
- `PROJECT_MANAGER` of that specific project (or `ADMIN`/`SYSTEM_ADMIN`) only
- 409 unless the entry's report is already `COMPLETED`
- Touches only that one entry, never the rest of the report

### Real-Time Blocker Endpoints (INDEPENDENT)

**`POST /api/blockers`** — report a blocker, anytime
- Body: `{ projectId, description, severity? }` (`severity` defaults to `MEDIUM`)
- Creates with `status: OPEN`
- **Caller must be an active member of the target project** (any of PM/Developer/Designer) — `ADMIN`/`SYSTEM_ADMIN` may report on any project regardless of staffing. *(This is a deliberate tightening added after the original design — see §12; the original design allowed anyone with the role to report on any project with no staffing check at all.)*

**`PATCH /api/blockers/:blockerId`** — update description/severity/status
- Only the original reporter (re-checked for still-active membership) or a `PROJECT_MANAGER` staffed on that project, or `ADMIN`/`SYSTEM_ADMIN`
- Status moves forward-only (`OPEN → IN_PROGRESS → RESOLVED`); `OPEN → RESOLVED` directly is allowed (skipping `IN_PROGRESS`); any backward move is 409
- `resolutionNotes` required exactly when resolving (400 if missing when resolving, 400 if sent without resolving)
- Once `RESOLVED`: locked, 409 on any further edit — no override, not even for `ADMIN`/`SYSTEM_ADMIN`

**`GET /api/blockers`** — list blockers
- `PROJECT_MANAGER`/`ADMIN`/`SYSTEM_ADMIN` see company-wide; **`DEVELOPER`/`DESIGNER` are scoped to blockers on projects they're actively staffed on** *(also tightened after the original design — see §12; originally this endpoint was PM/Admin-only)*
- Filters: `status`, `severity`, `projectId`

**`GET /api/projects/:projectId/blockers`** — this project's blockers (PM dashboard)
- `PROJECT_MANAGER`/`ADMIN`/`SYSTEM_ADMIN` company-wide (no staffing check to *read*); `DEVELOPER`/`DESIGNER` must be an active member of this specific project
- Filters: `status`, `severity`

Every blocker response includes `resolutionTime` (minutes, once resolved) and `daysOpen` (while still open) — both computed on read, never stored (see §6).

---

## 4. Service Layer Architecture (as implemented)

Neither feature got its own Nest module. Both live flat inside the existing `src/modules/projects/`, registered in `ProjectsModule` — see §12 for why.

**`DailyWorkReportService`** (`src/modules/projects/daily-work-report.service.ts`)
- `create(userId, dto)` → creates report + entries, posts to Slack (see §7)
- `findByUserAndDate(userId, date)`
- `findAllForUser(actorId, actorRole, query)`
- `updatePlan(reportId, userId, dto)` → state-based lock
- `submitWrapUp(reportId, userId, dto)` → upserts per project, posts to Slack
- `updateWrapUp(reportId, userId, dto)` → 2h time-based lock

**`DailyProjectEntryService`** (`src/modules/projects/daily-project-entry.service.ts`)
- `review(entryId, dto, actorId, actorRole)`

**`BlockerService`** (`src/modules/projects/blocker.service.ts`)
- `addBlocker(dto, actorId, actorRole)` — requires active project membership (or ADMIN/SYSTEM_ADMIN), posts to Slack
- `updateBlocker(blockerId, dto, actorId, actorRole)` — validates transition, posts to Slack on status change
- `findAll(query, actorId, actorRole)` — staff-scoped for DEVELOPER/DESIGNER
- `findByProject(projectId, query, actorId, actorRole)`
- `withMetrics()` (private) — derives `resolutionTime`/`daysOpen`

### Validation rules actually enforced

**Daily Work Reports:**
1. One per user per day (`@@unique` enforced, 409 on conflict)
2. Plan required first — `submitWrapUp()` throws 409 unless `status === PLAN_SUBMITTED`
3. Wrap-up may include projects not in the plan (upsert, not update-only)
4. Plan editable anytime pre-wrap-up (state lock); wrap-up editable for 2h post-submission (time lock) — two independent checks, `canEditPlan()`/`canEditWrapUp()`

**Blockers:**
1. Project must exist (404 otherwise)
2. Reporting requires active project membership, any role (or ADMIN/SYSTEM_ADMIN bypass)
3. Status: `OPEN → IN_PROGRESS → RESOLVED`, forward-only, `IN_PROGRESS` may be skipped
4. `resolutionNotes` required exactly when resolving
5. `RESOLVED` is permanently locked, no exceptions

---

## 5. Controllers & Routes (as implemented)

**`DailyWorkReportController`** (`@Controller('daily-work-reports')`)
```
POST   /api/daily-work-reports
PATCH  /api/daily-work-reports/:id/plan
GET    /api/daily-work-reports/today
GET    /api/daily-work-reports                                     — findAllForUser()
POST   /api/daily-work-reports/:id/wrap-up
PATCH  /api/daily-work-reports/:id/wrap-up
PATCH  /api/daily-work-reports/:reportId/entries/:entryId/review
```

**`ProjectDailyWorkReportsController`** (`@Controller('projects/:projectId/daily-work-reports')`)
```
GET    /api/projects/:projectId/daily-work-reports                 — findByProject()
```

**`BlockersController`** (`@Controller('blockers')`, deliberately not project-nested — a blocker can be reported/updated without knowing a project-scoped route up front, same reasoning as `TimeEntriesController`)
```
POST   /api/blockers
PATCH  /api/blockers/:blockerId
GET    /api/blockers
```

**`ProjectBlockersController`** (`@Controller('projects/:projectId/blockers')`, the PM dashboard read)
```
GET    /api/projects/:projectId/blockers
```

### Access control (as implemented)

**Daily Work Reports:**
- `POST /daily-work-reports`, plan/wrap-up updates: `@Roles([DEVELOPER, DESIGNER])` + ownership
- `GET /daily-work-reports`, `GET .../today`: same roles, self-vs-staff scoping in the service
- `GET /projects/:projectId/daily-work-reports`: `@Roles([DEVELOPER, DESIGNER, PROJECT_MANAGER])`, staffing-scoped for DEVELOPER/DESIGNER
- `PATCH .../review`: `@Roles([PROJECT_MANAGER])` (ADMIN/SYSTEM_ADMIN auto-unioned in by the `Roles()` decorator wrapper) + PM-of-project

**Blockers:**
- `POST /blockers`, `PATCH /blockers/:id`: `@Roles([DEVELOPER, DESIGNER, PROJECT_MANAGER])` + active-membership/PM-of-project check in the service
- `GET /blockers`, `GET /projects/:projectId/blockers`: same role list, staff-scoped for DEVELOPER/DESIGNER, company-wide for PROJECT_MANAGER

`Roles([...])` always implicitly admits `ADMIN`/`SYSTEM_ADMIN` too — see `src/common/decorators/roles.decorator.ts`.

---

## 6. Derived Fields

Resolution time and days-open are **never stored** — computed on every read from `createdAt`/`resolvedAt`, the same convention this codebase uses for `days` on `Holiday`/`LeaveRequest` and `remainingHours` on `Project`:

```typescript
private withMetrics(blocker) {
  const resolutionTime = blocker.resolvedAt
    ? Math.round((blocker.resolvedAt.getTime() - blocker.createdAt.getTime()) / 60_000)
    : undefined;
  const daysOpen = blocker.resolvedAt
    ? undefined
    : Math.floor((Date.now() - blocker.createdAt.getTime()) / (24 * 60 * 60 * 1000));
  return { ...blocker, resolutionTime, daysOpen };
}
```

---

## 7. Slack Integration (built afterward, as a separate feature)

Slack support for both features shipped later, as its own feature — see `docs/features/slack-integration/DESIGN.md` for the complete design. Summary as it applies here:

- **Plan/wrap-up**: posts to the project's own Slack channel (one message per `DailyProjectEntry`, `ts` stored in `planProjectSlackTs`/`wrapUpProjectSlackTs`) **and** to one fixed company-wide feed channel (`SLACK_DAILY_FEED_CHANNEL_ID`) as a single combined message per report covering every project touched that day (`ts` stored in `planFeedSlackTs`/`wrapUpFeedSlackTs` on `DailyWorkReport`, not per entry). Editing a plan/wrap-up within its edit window edits both messages in place (`chat.update`) rather than posting a new one — the combined feed message is always rebuilt from the report's *current* full entry set, not just the entry that changed.
- **Blockers**: posts to the project's own Slack channel only (never the feed channel) on both report and every status change. No `ts` is stored for blockers — each status change is its own new message, not an edit of a previous one, unlike plan/wrap-up.
- Message text uses a shared bullet-point formatter (one `•` line per non-empty line of free text) and a `*Author — Title (YYYY-MM-DD)*` header, consistent across both features.
- Every Slack call is fire-and-forget and never fails the underlying request — a project with no Slack channel, or a user with no resolvable Slack account, causes a silent no-op, never an error.

---

## 8. Business Rules & Validation Summary

| Rule | Where Enforced | Error |
|------|---|---|
| One report per user per day | Prisma `@@unique` | 409 |
| Plan required before wrap-up | Service layer | 409 |
| Plan editable until wrap-up submitted | Service layer | 409 |
| Wrap-up editable for 2h after submission | Service layer | 409 |
| Reviewing requires the report be `COMPLETED` | Service layer | 409 |
| Blocker reporter must be an active project member (or Admin/System Admin) | Service layer | 403 |
| Blocker editable until `RESOLVED` | Service layer | 409 |
| Status progression forward-only | Service layer | 409 |
| Resolution notes required exactly when resolving | Service layer | 400 |
| Only reporter (if still active) or PM-of-project (or Admin/System Admin) may update a blocker | Service layer | 403 |

---

## 9. ProjectActivity Integration

```
PLAN_SUBMITTED         { entries }
PLAN_UPDATED           { entries }
WRAP_UP_SUBMITTED      { entries }
WRAP_UP_UPDATED        { entries }
WORK_REPORT_REVIEWED   { dailyProjectEntryId }
BLOCKER_ADDED          { blockerId, severity }
BLOCKER_STATUS_CHANGED { blockerId, from, to }
```

All written through the shared `ProjectActivityService`, the same instance the rest of `ProjectsModule` uses — see §12.

---

## 10. Not Built / Deliberately Out of Scope

- No notification/reminder system for a missing daily submission.
- No AI scope analysis of any kind in this feature (that's the separate Additional Requirements feature's gap, not this one's).
- Phase 3 "combined dashboards / analytics / SLA tracking" from the original roadmap was never built and isn't currently planned.

---

## 11. Key Design Decisions (unchanged from original reasoning)

- **Blockers are completely independent of daily reports** — different lifecycle (can span days, not tied to a calendar date), different visibility need (PM needs real-time cross-day status, not a daily snapshot).
- **2-hour wrap-up edit window, no window for the plan** — the plan can be revised freely up until it's superseded by a wrap-up; once submitted, the wrap-up is a settled record with only a short grace period for typo fixes.
- **Blockers have no edit window at all** — only the terminal `RESOLVED` state locks them, since a blocker can legitimately take days to resolve.

---

## 12. What Changed From the Original Design

This section replaces the old "Document Versioning" table — it records the concrete deltas between the original pre-build design and what actually shipped, so this document doesn't need a parallel changelog going forward (git history covers that).

1. **No standalone modules.** The original design proposed `src/modules/daily-work-reports/` and `src/modules/blockers/`. Both ended up flat inside the existing `src/modules/projects/`, registered in `ProjectsModule` — anything needing `ProjectActivityService`/`ProjectMember` checks lives there to avoid a second, duplicate DI instance of `ProjectActivityService`. Daily Work Reports was actually built standalone first and then merged in after hitting exactly that duplicate-instance bug; Blockers was built flat from the start, informed by that experience.
2. **`DailyWorkReportStatus` defaults to `PLAN_SUBMITTED`, not `DRAFT`.** `DRAFT` exists in the enum for forward compatibility but `create()` never produces it — submitting a plan is what creates the row at all.
3. **Blocker relation/field names differ from the original sketch.** `reportedById`/`reportedBy` and `resolvedById`/`resolvedBy` (not `createdBy`/`createdByUser`), matching this codebase's existing naming convention.
4. **Blocker access control is tighter than first designed.** Reporting now requires active project membership (originally: any DEVELOPER/DESIGNER/PROJECT_MANAGER could report on any project with no staffing check). `GET /blockers` is now staff-scoped for DEVELOPER/DESIGNER rather than PM/Admin-only.
5. **Slack integration shipped later, as its own separate feature**, not inline with either of these two — no queue/Bull infrastructure was ever introduced; every Slack call is a direct, un-awaited, fire-and-forget API call. See `docs/features/slack-integration/DESIGN.md`.
6. **`GET /daily-work-reports` and `GET /projects/:projectId/daily-work-reports` were added** — not in the original endpoint list, added because "one person's history across every project" and "one project's history across every person" are both real, distinct questions.
7. **No unit tests exist for either feature** (or anywhere else in this backend yet) — see CLAUDE.md's Testing note.
