# Daily Work Report & Real-Time Blockers: Architecture & Best Practices

**Purpose**: Document the patterns actually used in the shipped implementation
**Audience**: Backend engineers extending this feature
**Version**: 1.0 (As-built) — see `DESIGN.md` §12 for how this diverged from the pre-build plan

---

## 1. Design Philosophy

### Daily Work Reports (Developer-Centric)
- One report per person per day
- Plan: no time limit, locked only once wrap-up is submitted (state-based)
- Wrap-up: locked 2 hours after submission (time-based)
- Tied to specific date

### Real-Time Blockers (Project-Centric) — COMPLETELY INDEPENDENT
- No foreign key to daily reports at all
- Can be added/resolved anytime, can span multiple days
- Locked only once `RESOLVED` (terminal, no time-based lock)
- Reporting requires active membership on the target project (or ADMIN/SYSTEM_ADMIN)

### Core Tenets

**Two independent edit windows, not one**
- Plan: state-based lock (editable until wrap-up exists)
- Wrap-up: time-based lock (2 hours post-submission)
- Blockers: no time-based lock at all — only the terminal `RESOLVED` state locks them

**Complete separation between the two features**
- No shared foreign key, no shared service beyond `ProjectActivityService`
- Both live in the same module (`src/modules/projects/`) for a DI reason (§7), not because they're related

**Derived, not stored**
- `resolutionTime`/`daysOpen` are computed on every read from `createdAt`/`resolvedAt` — never persisted

---

## 2. Data Access Patterns

### Daily Reports: per-day queries

```typescript
const report = await this.prisma.dailyWorkReport.findUnique({
  where: { userId_date: { userId, date: toDateOnly(new Date()) } },
  include: {
    entries: {
      include: { project: { select: { id: true, name: true, slackChannelId: true } } },
    },
  },
});
```

`toDateOnly()` truncates to the UTC calendar day — not the caller's local timezone. For Bangladesh (UTC+6) this means "today" rolls over at 6am local time, not local midnight.

### Blockers: continuous queries, not scoped to a date

```typescript
const activeBlockers = await this.prisma.blocker.findMany({
  where: { projectId, status: { not: 'RESOLVED' } },
  include: { reportedBy: true, resolvedBy: true },
  orderBy: { createdAt: 'desc' },
});
// This query returns the same shape on Monday and on Friday — nothing about
// it is date-scoped, by design.
```

`BlockerService.findAll()` additionally scopes by staffing for `DEVELOPER`/`DESIGNER` callers — see §4.

---

## 3. Edit Windows (Daily Reports Only)

### Plan Phase — state-based, no time limit

```typescript
// Simplified from DailyWorkReportService.updatePlan()
async updatePlan(reportId: string, userId: string, dto: UpdatePlanDto) {
  const report = await this.prisma.dailyWorkReport.findUnique({ where: { id: reportId } });
  if (!report || report.userId !== userId) {
    throw new ForbiddenException('Cannot edit this report');
  }
  if (report.status !== DailyWorkReportStatus.PLAN_SUBMITTED) {
    throw new ConflictException('Plan locked after wrap-up submitted.');
  }
  // ...update entries, log PLAN_UPDATED, post to Slack...
}
```

### Wrap-Up Requires a Plan First

```typescript
// Simplified from DailyWorkReportService.submitWrapUp()
async submitWrapUp(reportId: string, userId: string, dto: SubmitWrapUpDto) {
  const report = await this.prisma.dailyWorkReport.findUnique({
    where: { id: reportId },
    include: { entries: true },
  });
  if (!report || report.userId !== userId) {
    throw new ForbiddenException('Cannot submit wrap-up for this report');
  }
  if (report.status !== DailyWorkReportStatus.PLAN_SUBMITTED) {
    throw new ConflictException('Must submit plan first before submitting wrap-up');
  }

  // Upsert per entry: update if the project was in the plan, create a new
  // entry if it wasn't (unplanned/urgent work added at wrap-up time).
  for (const entry of dto.entries) {
    const existing = report.entries.find((e) => e.projectId === entry.projectId);
    if (existing) {
      await this.prisma.dailyProjectEntry.update({
        where: { id: existing.id },
        data: { accomplishments: entry.accomplishments },
      });
    } else {
      await this.prisma.dailyProjectEntry.create({
        data: { dailyWorkReportId: report.id, projectId: entry.projectId, accomplishments: entry.accomplishments },
      });
    }
  }

  return this.prisma.dailyWorkReport.update({
    where: { id: reportId },
    data: { status: DailyWorkReportStatus.COMPLETED, wrapUpSubmittedAt: new Date() },
  });
}
```

### Wrap-Up Phase — time-based, 2-hour window

```typescript
const canEditWrapUp = (report: DailyWorkReport): boolean => {
  if (report.status !== 'COMPLETED') return false;
  const twoHoursMs = 2 * 60 * 60 * 1000;
  return Date.now() - report.wrapUpSubmittedAt!.getTime() < twoHoursMs;
};
```

### Blockers — no time-based window

Blockers have no 2-hour rule at all. They're editable by the reporter or a project-PM anytime up until `RESOLVED`, at which point they're permanently locked (no override, not even for ADMIN/SYSTEM_ADMIN).

---

## 4. Blocker Status Machine

### State Transitions

```
OPEN (reported)
  ↓
IN_PROGRESS (optional — may be skipped)
  ↓
RESOLVED ← TERMINAL, no exceptions
```

### As Actually Implemented (`blocker.service.ts`)

```typescript
const STATUS_ORDER: Record<BlockerStatus, number> = { OPEN: 0, IN_PROGRESS: 1, RESOLVED: 2 };

async updateBlocker(blockerId: string, dto: UpdateBlockerDto, actorId: string, actorRole: Role) {
  const blocker = await this.getBlockerOrThrow(blockerId);

  if (blocker.status === 'RESOLVED') {
    throw new ConflictException('This blocker is already resolved and can no longer be edited');
  }

  await this.assertCanUpdate(blocker, actorId, actorRole); // reporter (still active) OR PM-of-project OR Admin/System Admin

  if (dto.status && STATUS_ORDER[dto.status] < STATUS_ORDER[blocker.status]) {
    throw new ConflictException(`Cannot move a blocker backward from ${blocker.status} to ${dto.status}`);
  }
  if (dto.status === 'RESOLVED' && !dto.resolutionNotes) {
    throw new BadRequestException('resolutionNotes is required when resolving a blocker');
  }
  if (dto.resolutionNotes !== undefined && dto.status !== 'RESOLVED') {
    throw new BadRequestException('resolutionNotes only applies when resolving a blocker');
  }

  const updated = await this.prisma.blocker.update({
    where: { id: blockerId },
    data: {
      ...dto,
      ...(dto.status === 'RESOLVED' && { resolvedAt: new Date(), resolvedById: actorId }),
    },
    include: BLOCKER_INCLUDE,
  });

  // log BLOCKER_STATUS_CHANGED, post to Slack (fire-and-forget) if status changed
  return this.withMetrics(updated);
}
```

Reporting itself (`addBlocker`) requires being an active member of the target project in any role — `assertCanReport()` — unless the caller is ADMIN/SYSTEM_ADMIN. This is stricter than the original design, which allowed anyone with the right global role to report on any project regardless of staffing.

---

## 5. Slack Notifications (fire-and-forget, no queue)

### No Queue Infrastructure Was Ever Built

The original architecture notes for this feature proposed a Bull/Redis queue for Slack posting. That was never built, here or anywhere else in this backend. When Slack integration shipped (as its own separate feature — see `docs/features/slack-integration/DESIGN.md`), it used a simpler pattern instead: call the Slack API directly, don't `await` the call in a way that would delay the response, and catch-and-log any failure.

```typescript
// Actual pattern from BlockerService.addBlocker()
const blocker = await this.prisma.blocker.create({ data: { ...dto, reportedById: actorId } });

await this.projectActivity.log(dto.projectId, actorId, 'BLOCKER_ADDED', { /* ... */ });

this.postBlockerAddedToSlack(blocker).catch((error) => {
  this.logger.warn(`Failed to post blocker ${blocker.id} to Slack: ${error}`);
});

return this.withMetrics(blocker);
```

`postBlockerAddedToSlack()` itself no-ops immediately if `blocker.project.slackChannelId` is `null` — a project without a working Slack channel never blocks blocker creation.

There is no PM Slack DM for HIGH-severity blockers — that idea was floated in the original design and never built.

---

## 6. Calculating Derived Fields

```typescript
// Never stored — calculated on every read
private withMetrics(blocker: BlockerWithRelations) {
  const resolutionTime = blocker.resolvedAt
    ? Math.round((blocker.resolvedAt.getTime() - blocker.createdAt.getTime()) / 60_000)
    : undefined;
  const daysOpen = blocker.resolvedAt
    ? undefined
    : Math.floor((Date.now() - blocker.createdAt.getTime()) / (24 * 60 * 60 * 1000));
  return { ...blocker, resolutionTime, daysOpen };
}
```

Same convention as `days` on `Holiday`/`LeaveRequest` and `remainingHours` on `Project` — this codebase consistently derives read-time metrics rather than storing them and risking drift.

---

## 7. Why Both Features Live Flat in `ProjectsModule`

Neither `DailyWorkReportService`/`DailyProjectEntryService` nor `BlockerService` got a standalone Nest module, even though `src/modules/<feature>/` is the default shape for a new feature elsewhere in this codebase (see CLAUDE.md's Module layout section). Both need `ProjectActivityService` (to write timeline entries) and direct `ProjectMember` checks (staffing/active-membership queries) — putting either service in its own module would mean either a second, duplicate DI instance of `ProjectActivityService`, or exporting it across modules for no real benefit. Daily Work Reports was actually built standalone first and hit exactly that duplicate-instance bug; it was merged flat into `ProjectsModule` afterward. Blockers was built flat from the start, informed by that experience.

---

## 8. Error Handling & Validation

### Daily Reports: DTO + service + route guard, same as everywhere else in this codebase

```typescript
// DTO level
class SubmitPlanDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => DailyProjectEntryPlanDto) @ArrayMinSize(1)
  entries: DailyProjectEntryPlanDto[];
}

// Service level
if (report.status !== DailyWorkReportStatus.PLAN_SUBMITTED) {
  throw new ConflictException('Plan locked after wrap-up submitted.');
}

// Controller level
@Post()
@Roles([Role.DEVELOPER, Role.DESIGNER])
submitPlan(@Body() dto: SubmitPlanDto, @CurrentUser() user: { id: string }) {
  return this.dailyWorkReportService.create(user.id, dto);
}
```

### Blockers: same three layers, no 2h-window check

```typescript
class AddBlockerDto {
  @IsUUID() projectId: string;
  @IsString() @IsNotEmpty() description: string;
  @IsOptional() @IsEnum(BlockerSeverity) severity?: BlockerSeverity;
}
```

---

## 9. Testing Strategy

**As of this writing, there are no unit tests (`*.spec.ts`) anywhere in this backend** — not for these two features, not for anything else. See CLAUDE.md's Testing note. If test coverage becomes a priority, start here: `updatePlan()`'s state-based lock, `updateWrapUp()`'s 2-hour time-based lock, and `updateBlocker()`'s forward-only transition + resolved-lock logic are the highest-value units to cover first, since they're pure conditional logic with no external side effects beyond the Prisma write.

---

## 10. Common Pitfalls

| Pitfall | Resolution |
|---------|----------|
| Assuming blockers have a 2h edit window like wrap-ups | They don't — no time-based lock at all, only the terminal `RESOLVED` state |
| Assuming a plan can be edited after wrap-up is submitted | It can't — state-based lock, not time-based |
| Reaching for a queue for Slack posting | Not used anywhere in this backend — direct, un-awaited API call + catch-and-log is the established pattern |
| Assuming any DEVELOPER/DESIGNER/PM can report a blocker on any project | Reporting requires active membership on that specific project (or ADMIN/SYSTEM_ADMIN) |
| Storing resolution time or days-open | Calculate on read: `(resolvedAt - createdAt) / 60_000` |
| Forgetting "today" is a UTC calendar day | `toDateOnly()` truncates via UTC, not local time — see §2 |

---

## 11. Real-World Flow (Multi-Day Blocker)

```
Monday 10:30 AM   Dev (active member of the project) reports a blocker → OPEN
                  → BLOCKER_ADDED logged, posted to the project's Slack channel

Tuesday 2:00 PM   PM moves it → IN_PROGRESS
                  → BLOCKER_STATUS_CHANGED logged, posted to Slack

Wednesday 11:00 AM  PM resolves it, providing resolutionNotes → RESOLVED
                  → resolvedAt/resolvedById set, resolutionTime derivable as ~2 days
                  → posted to Slack, now permanently locked
```

---

## 12. Recommended Reading

- `DESIGN.md` — the full specification, as actually implemented
- `src/modules/projects/daily-work-report.service.ts`, `daily-project-entry.service.ts`, `blocker.service.ts` — the real code
- `src/modules/projects/project-activity.service.ts` — shared activity logging
- `docs/features/slack-integration/DESIGN.md` — how Slack posting actually works, built as a separate later feature
