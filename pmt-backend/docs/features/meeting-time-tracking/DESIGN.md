# Meeting Time Tracking, Design Draft

**Version**: 0.2 (draft, not yet reviewed or built)
**Status**: Proposed
**Created**: 2026-08-05
**Updated**: 2026-08-05, added the same day completion and lock rule in section 2 and 4.9

Not sourced from `pixelvega-build-spec.md`, a grep of that file for "meeting" only turns up the unrelated `MEETING_NOTE` document type. This is a new idea raised directly by Jabed on 2026-08-05, not an existing spec line. If this design is approved and built, `pixelvega-build-spec.md` and `CLAUDE.md` should both be updated the same way `docs/features/internal-review/DESIGN.md` was, per that file's own closing status line.

---

## 1. Problem

`TimeEntry` (`prisma/schema.prisma`) requires a real `projectId`. Every minute anyone tracks today has to be logged against a project. But a normal working day also includes office meetings (standups, planning, client calls that are not billed as a specific project's work, all hands, etc.) that are not any single project's time.

Right now that meeting time is invisible to the system in two ways:

1. **The daily and per project numbers look short.** If a developer works 5 hours on a project and spends 2 hours in office meetings, `GET /projects/:projectId/time-entries/daily-summary` and `GET /time-entries/project-summary` both only ever show the 5 hours. There is nowhere to see the other 2 hours, or even confirm they were meeting time rather than idle time.
2. **The one active timer rule can be worked around silently.** Someone in a 2 hour meeting has no way to say so in the system today, so either they leave a project timer running through the meeting (inflating that project's `actualHours`), or they just do not track anything for those 2 hours (their day looks like it was only 5 hours long).

The ask: when looking at time tracking for a given day, also show how much of that day went to office meetings, so the gap between "hours tracked on projects" and "hours actually worked" is explained rather than silently missing.

## 2. Proposed Business Rules

1. A staff member (`ADMIN`, `PROJECT_MANAGER`, `DEVELOPER`, `DESIGNER`) can start, pause, resume, and stop a meeting timer, the same segment based flow `TimeEntry` already uses for project work. `CLIENT` never tracks time of any kind, unchanged.
2. A meeting timer is not attached to any project. It belongs to the user only.
3. **Only one timer of any kind can be running for a person at once.** Starting a meeting timer while a project timer is running (or the reverse) is rejected with the same 409 the project timer flow already returns for a second project timer. A person cannot be in a meeting and doing timed project work at the same moment.
4. A single continuous meeting segment is capped at the same `MAX_CONTINUOUS_SESSION_MINUTES` (9 hours) as project time, auto stopped the same lazy way (checked next time that row is touched, not a background job).
5. Meeting time is never attributed to a project and never feeds `Project.actualHours`. It is its own number, shown alongside project hours, not folded into them.
6. Viewing a day's time (a new endpoint, see below) shows three numbers: hours tracked across all projects that day, hours in meetings that day, and the combined total. This is the part that directly answers the original ask.
7. **A time entry, project or meeting, must be started and finished within the same UTC calendar day.** If someone forgets to start a timer, they can still start it later that same day, there is no requirement that a segment begin at the start of the day. But it must be stopped before the day ends. This applies to both `TimeEntry` and `OtherTimeEntry`, not only meetings, since the underlying concern (an open clock surviving into the next day) is the same for both.
8. **The day a segment started on is locked once that day has passed.** Once the UTC calendar day rolls over, a `RUNNING` or `PAUSED` entry that started on the earlier day can no longer be paused, resumed, or stopped by hand, and there is no way to create a new entry backdated to a day earlier than today. See 4.9 for how this is enforced without a background job.

## 3. Non Goals for v1

- **No meeting categories beyond office meetings.** A `type` field is included on the new model (see schema below) so a second category (training, admin work, etc.) is a one line enum addition plus a hand written migration later, the same way `ProjectActivityType`/`ProjectDocumentType` have grown over time. Nothing beyond `OFFICE_MEETING` is being built now.
- **No linking a meeting to a project, a calendar event, or a list of attendees.** This is a single number for "time not spent on project work," not a meetings feature with agendas or invitees.
- **No change to `Project.actualHours` or any project scoped report.** Meeting time is intentionally kept out of every project number that already exists.
- **No Slack posting.** Nothing in `docs/features/slack-integration/DESIGN.md` calls for a meeting hook, and this draft is not adding one.
- **No PM approval or review step.** Same trust level as starting a project timer today, no extra gate.
- **No hard requirement that every work day has at least one entry.** "Must give an entry for that day" is enforced here as "whatever you started must be finished the same day and cannot be changed after," not as "you are blocked from doing anything else until you log something." A blocking minimum would need to account for leave days, holidays, and days someone is simply not staffed on anything yet, which is a policy question bigger than this draft. A report showing who logged zero time on a given work day is a reasonable follow on for `PROJECT_MANAGER`/`ADMIN`, flag if that visibility is wanted, it is not built here.

## 4. Architecture

### 4.1 Schema addition: `prisma/schema.prisma`

```prisma
enum OtherTimeEntryType {
  OFFICE_MEETING
}

model OtherTimeEntry {
  id     String             @id @default(uuid())
  userId String
  user   User               @relation(fields: [userId], references: [id])
  type   OtherTimeEntryType @default(OFFICE_MEETING)

  sessionId String
  status    TimeEntryStatus @default(RUNNING)
  notes     String?

  startedAt       DateTime  @default(now())
  endedAt         DateTime?
  durationMinutes Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([userId, status])
  @@index([sessionId])
}
```

This is deliberately a sibling model, not a nullable `projectId` on the existing `TimeEntry`. Reasons:

- `TimeEntry.projectId` being required is relied on all over `project-time-entries.service.ts` (`recalculateActualHours`, `assertActiveMember`, every project scoped read). Making it nullable would mean auditing every one of those call sites for a null case that only applies to a feature that has nothing to do with projects.
- The rest of the codebase already prefers a new sibling model over overloading an existing one for a related but distinct concern, `Blocker` next to `DailyWorkReport`, `ClientFeedback` next to `ProjectInternalReview`. This follows the same pattern.
- `status`/`sessionId`/segment shape are reused as is from `TimeEntry` (same `TimeEntryStatus` enum), so the pause and resume append only logic can be copied nearly line for line rather than reinvented.

`User.otherTimeEntries OtherTimeEntry[]` relation added to `User`.

Hand written migration under `prisma/migrations/<timestamp>_add_other_time_entries/migration.sql`, applied with `prisma migrate deploy`, per CLAUDE.md's non interactive shell note, followed by `prisma generate`.

### 4.2 New service: `OtherTimeEntriesService` (`src/modules/projects/other-time-entries.service.ts`)

Flat inside the existing `ProjectsModule`, same reasoning as every other provider there: it needs to coordinate with `ProjectTimeEntriesService`'s one timer rule, so it lives next to it rather than in its own module.

- `start(userId, dto)`: rejects (409) if the user already has a `RUNNING` row in **either** `TimeEntry` or `OtherTimeEntry`. Creates a new row with `sessionId = id`, same self referential pattern as `ProjectTimeEntriesService.start()`.
- `pause` / `resume` / `stop`: copy `ProjectTimeEntriesService`'s segment logic verbatim, minus anything project or `ProjectActivity` related (there is no project to log an activity against).
- `autoStopIfExpired(entry)`: same 9 hour cap logic as the project version, reusing the existing `MAX_CONTINUOUS_SESSION_MINUTES` constant from `time-tracking.constants.ts` rather than a second constant.
- `findActiveForUser(userId)`: returns the running or paused-most-recently-open row, if any. Used by the shared `active` check below.
- `findDailyMinutes(userId, startDate?, endDate?)`: sums `durationMinutes` for finalized rows grouped by the UTC calendar day of `startedAt`, reusing `buildStartedAtFilter` (moved to a shared location, see 4.5) for the date range. Returns `Map<dateString, minutes>`, consumed by the new combined endpoint below, not exposed as its own route.

### 4.3 Existing code that must change: the one timer rule now spans two tables

`ProjectTimeEntriesService.assertNoRunningTimer()` currently only queries `TimeEntry`. It must also check `OtherTimeEntry` for a `RUNNING` row before allowing a project timer to start or resume, otherwise someone could start a project timer while their meeting timer is still running. `OtherTimeEntriesService.start()` needs the same check in reverse.

Rather than a shared helper, this follows the existing convention in this module of duplicating small authorization or invariant checks per service (`assertActiveMember`, `assertManagesProject` are already duplicated this way across several services per CLAUDE.md's "Module layout" note), so each service's `assertNoRunningTimer` queries both tables directly.

`ProjectTimeEntriesService.findActiveForUser()` (backing `GET /time-entries/active`) also needs to check `OtherTimeEntry`, so "am I busy right now" correctly reports a running meeting, not only a running project timer. Proposed response shape change:

```
GET /time-entries/active
{
  "active": boolean,
  "kind": "PROJECT" | "MEETING" | null,
  "entry": { ...TimeEntry, project: { id, name } } | { ...OtherTimeEntry } | null
}
```

`kind` is new; existing consumers reading `active`/`entry` for the project case are unaffected as long as they check `kind === "PROJECT"` first, which nothing currently does since this shape does not exist yet.

### 4.4 New endpoint: combined daily view

This is the part that directly answers the original ask, a day by day number for project hours next to meeting hours.

`GET /time-entries/daily-summary` (top level, on the existing `TimeEntriesController`, not project nested, mirroring `GET /time-entries/project-summary`'s existing top level, cross project pattern):

- Self scoped for `DEVELOPER`/`DESIGNER` (403 on a `userId` other than their own, same rule `findActiveForUser`/`findProjectSummaryForUser` already use). `PROJECT_MANAGER`/`ADMIN`/`SYSTEM_ADMIN` may pass `userId` to view anyone.
- Accepts optional `startDate`/`endDate`, same inclusive both ends convention as every other date filter in this module (`buildStartedAtFilter`).
- For each UTC calendar day in range: sums finalized `TimeEntry.durationMinutes` across every project that user touched that day (reusing the grouping already written for `findProjectSummaryForUser`, just keyed by day instead of by project), plus that day's `OtherTimeEntriesService.findDailyMinutes()` result.

```
GET /time-entries/daily-summary?userId=...&startDate=2026-08-01&endDate=2026-08-05
{
  "days": [
    {
      "date": "2026-08-04",
      "projectMinutes": 300,
      "meetingMinutes": 120,
      "totalMinutes": 420
    },
    ...
  ],
  "totalProjectMinutes": ...,
  "totalMeetingMinutes": ...,
  "totalMinutes": ...
}
```

Naming note: `GET /projects/:projectId/time-entries/daily-summary` already exists and means something different (one project, grouped by day). This new one is cross project and lives on `TimeEntriesController`, not `ProjectTimeEntriesController`, so the two do not collide as routes, only in the "daily summary" name in prose.

### 4.5 Small refactor needed to share code cleanly

`buildStartedAtFilter()` currently lives as a private method on `ProjectTimeEntriesService`. Both `OtherTimeEntriesService` and the new combined endpoint need the exact same date range semantics, so it should move to a plain exported function (for example `src/modules/projects/time-entry-date.util.ts`), used by all three call sites, rather than copy and pasted three times. This is the one exception to the "duplicate small checks per service" convention noted in 4.3: that convention is for authorization/invariant checks that read naturally next to the rest of each service, whereas date math has no judgment call in it and drifting out of sync here would silently break one of the three call sites' date filters.

### 4.6 New DTOs

- `src/modules/projects/dto/start-other-time-entry.dto.ts`: `StartOtherTimeEntryDto`, `type?: OtherTimeEntryType` (defaults to `OFFICE_MEETING` if omitted, kept optional now since it is the only value; required once a second type exists), `notes?: string`.
- `src/modules/projects/dto/query-daily-summary.dto.ts`: `userId?: string`, `startDate?: string`, `endDate?: string`, same shape as the existing `QueryProjectSummaryDto`.

### 4.7 Controller routes: extend `TimeEntriesController` (`src/modules/projects/time-entries.controller.ts`)

| Route | Roles | Action |
|---|---|---|
| `POST /time-entries/meetings/start` | ADMIN, PROJECT_MANAGER, DEVELOPER, DESIGNER | `OtherTimeEntriesService.start` |
| `PATCH /time-entries/meetings/:id/pause` | same | `pause` |
| `PATCH /time-entries/meetings/:id/resume` | same | `resume` |
| `PATCH /time-entries/meetings/:id/stop` | same | `stop` |
| `GET /time-entries/meetings` | same | list, self scoped, `userId` override for PM/ADMIN, same pattern as project time entries |
| `GET /time-entries/daily-summary` | same | the combined view in 4.4 |

`GET /time-entries/active` (existing route) changes its response shape per 4.3, no new route needed.

### 4.8 Module registration

Add `OtherTimeEntriesService` to `ProjectsModule`'s `providers`. No new controller class, routes are added to the existing `TimeEntriesController`. No new module.

### 4.9 Same day completion and lock

Covers rules 7 and 8 in section 2. Two separate mechanics, same as `DailyWorkReport`'s two independent edit windows (`canEditPlan()`/`canEditWrapUp()` in `daily-work-report.service.ts`): one is about auto finalizing a still open segment, the other is about refusing further edits once the day has passed. Both apply to `TimeEntry` and `OtherTimeEntry` equally.

**No backdating, by construction.** `startedAt` already always defaults to `now()` on both models and neither `start()` DTO accepts a caller supplied `startedAt`. There is nothing to add here, calling it out so it is not mistaken for a gap.

**Auto finalizing a segment that survives past its own day.** Today `autoStopIfExpired()` only checks elapsed minutes against `MAX_CONTINUOUS_SESSION_MINUTES`. It needs a second condition: a `RUNNING` entry whose `startedAt` falls on a UTC calendar day earlier than today must also be finalized, even if it has not run 9 hours yet. When both conditions could apply, the earlier boundary wins:

```
cutoff = min(startedAt + 9 hours, endOfUtcDay(startedAt))
```

`endOfUtcDay(startedAt)` is `23:59:59.999` UTC on the day `startedAt` falls on, the same UTC day convention `toDateOnly()` already uses in `daily-work-report.service.ts`. If `now >= cutoff`, the entry is finalized at exactly `cutoff` (not at `now`), the same "discard time past the boundary, do not carry it over" rule the 9 hour cap already uses. This still only runs lazily, on whatever next touches that row (the owner's next `start`, the shared `assertNoRunningTimer` check on either service, `findActiveForUser`, or that entry's own `pause`/`stop`), no cron job. In practice this means: if someone starts a timer at 6pm and never opens the app again that day, the entry sits `RUNNING` in the database until the next thing touches it (their next morning's `start()` call, most likely), at which point it gets finalized capped at that first day's `23:59:59.999` UTC rather than carrying an extra 14 hours of overnight time.

A `PAUSED` entry from a previous day needs no time correction, its `durationMinutes` is already fixed from when it was paused, but it still needs to be excluded from further action, see below.

**Locking further edits once the day has passed.** `pause`, `resume`, and `stop` on both services must check the entry's `startedAt` day against today before doing anything else, in addition to whatever checks they already run (ownership, `sessionId` supersession, and so on). If the entry's day is earlier than today, reject with 409, the same status code `resume()` already uses for a superseded segment, so this reads as one more case of "this segment is no longer actionable" rather than a new kind of error. A `RUNNING` entry from a previous day is caught by the auto finalize step above before this check would even run, so in practice this mostly guards `resume()` on a `PAUSED` entry left over from yesterday.

**Shared implementation.** This is date math with no per service judgment call in it, the same reasoning 4.5 already gives for moving `buildStartedAtFilter()` out of `ProjectTimeEntriesService`. `endOfUtcDay()` and a shared `isPreviousUtcDay(startedAt)` helper belong in the same `time-entry-date.util.ts` proposed in 4.5, used by both services' `autoStopIfExpired`/`pause`/`resume`/`stop`, rather than written twice and risking the two copies drifting apart on what "today" means.

---

## 5. What Does Not Change

- `TimeEntry`, `recalculateActualHours`, `Project.actualHours`, and every existing project scoped time entry route are untouched. Meeting time never touches a project's numbers.
- `GET /projects/:projectId/time-entries/daily-summary` (project scoped) keeps its current shape exactly. The new cross project daily view in 4.4 is an addition, not a replacement.
- `GET /time-entries/project-summary` is untouched.
- No `ProjectActivity` rows are produced by meeting time, there is no project to log an activity against.

## 6. Open Questions

1. **Should `PROJECT_MANAGER` be allowed to track meeting time?** They are excluded from project time tracking today (`TIME_TRACKING_ROLES` deliberately leaves them out, per CLAUDE.md, since overseeing many projects is the job, not billable project work). Office meetings are a different concern though, a PM sits in standups and planning too. This draft assumes yes, PM included, but that is worth confirming before building.
2. **Should `ADMIN`/`SYSTEM_ADMIN` be included at all?** They are auto unioned into most `@Roles([...])` lists via the `Roles` decorator convention, but this draft lists them explicitly rather than relying on that, since whether admins track their own time the same way is a separate question from role gated access.
3. **Naming**: `OtherTimeEntry`/`OtherTimeEntryType` was chosen to leave room for a second category later without a rename. If only office meetings will ever be tracked this way, a plainer `MeetingTimeEntry` with no `type` field at all is simpler and one less enum to think about. Worth deciding before the migration is written, changing this after real rows exist means a rename migration, not just an enum addition.

## 7. Status

- [ ] Design reviewed and approved
- [ ] Schema addition written and migrated
- [ ] `time-entry-date.util.ts` written (`buildStartedAtFilter`, `endOfUtcDay`, `isPreviousUtcDay`, per 4.5 and 4.9)
- [ ] `OtherTimeEntriesService` written
- [ ] `ProjectTimeEntriesService.assertNoRunningTimer`/`findActiveForUser` updated for the shared one timer rule (4.3)
- [ ] `autoStopIfExpired` on both services updated for the day boundary cutoff (4.9)
- [ ] `pause`/`resume`/`stop` on both services reject a previous day entry with 409 (4.9)
- [ ] DTOs written
- [ ] `TimeEntriesController` routes added
- [ ] Registered in `ProjectsModule`
- [ ] `CLAUDE.md` / `pixelvega-build-spec.md` updated
- [ ] `npx tsc --noEmit` / `pnpm lint` pass
- [ ] Manual smoke test: start a project timer, confirm a meeting timer cannot also start (409); stop it, start a meeting timer, confirm `GET /time-entries/active` reports `kind: "MEETING"`; confirm `GET /time-entries/daily-summary` shows both numbers for the same day
- [ ] Manual smoke test: start a timer, do not stop it, confirm it is still `RUNNING` in the database past midnight UTC, then confirm the next `start()`/`active` call finalizes it capped at that day's end and a `resume()` on a previous day's paused entry is rejected with 409
