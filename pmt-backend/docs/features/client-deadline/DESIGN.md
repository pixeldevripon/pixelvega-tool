# Client Deadline Feature Design

**Version**: 0.2 (draft)
**Status**: Proposed, not built
**Created**: 2026-08-19
**Updated**: 2026-08-19. All three open questions from v0.1 resolved (see §3), folded the write path into the existing generic update endpoint instead of a dedicated one.

Written as a quick draft per Jabed's request, following the same "write a design first" approach used in `docs/features/internal-review/DESIGN.md` and `docs/features/slack-integration/DESIGN.md`. Not yet reviewed against a real build spec line, this is a fresh idea rather than something already listed in `pixelvega-build-spec.md`.

---

## 1. Feature Overview

`Project.deadline` today serves two purposes at once: it is the working target Developer/Designer see and plan around, and it is also the date shown to the Client (`CLIENT_PROJECT_SELECT` includes it). In practice these are often not the same date. The internal team's working deadline is usually a few days tighter than what was actually promised to the client, sometimes with no gap at all, but the gap should not require editing the one shared field back and forth.

This feature adds a second date, `clientDeadline`, representing the real date communicated to the client. It is:

1. Set and updated only by a Project Manager (staffed on that specific project) or Admin/System Admin.
2. Visible to Project Manager and Admin/System Admin only. Developer and Designer must not see it at all, not even indirectly through the activity feed.
3. Independent of `Project.deadline`. Nothing recalculates it automatically; a PM sets it by hand and updates it by hand if it moves.

## 2. Business Rules (as proposed)

1. `clientDeadline` is optional (`null` until a PM sets one), same as `deadline`.
2. Only `PROJECT_MANAGER` staffed as PM on the project (via the existing `assertManagesProject()` check), or `ADMIN`/`SYSTEM_ADMIN`, may set or update it, through the existing generic `PATCH /projects/:id` (no new endpoint, see §4).
3. Developer and Designer never receive this field on any project read (`GET /projects/:id`, `GET /projects`, `GET /projects/mine`, `GET /projects/users/:userId`), and it is never referenced by name in anything they can read, including `ProjectActivity`.
4. Client can see it. `CLIENT_PROJECT_SELECT` gains `clientDeadline` alongside the existing `deadline` field, so a Client's own project view carries both.
5. No ordering constraint between `clientDeadline` and `deadline`. It can be earlier, later, or the same. No validation added.
6. No automatic relationship to `deadline`. `AdditionalRequirement.deadlineExtensionDays` and `Blocker.deadlineExtensionDays` keep extending `Project.deadline` only, exactly as they do today. If a client deadline needs to move because of an approved extra requirement or a resolved blocker, a PM does that as a second, separate edit.
7. Changing `clientDeadline` is logged, but through `AuditLogService`, not `ProjectActivityService`. This is a deliberate deviation from how most project field changes are logged in this module (see §4), because `ProjectActivity` is readable by any staffed Developer/Designer, and a `CLIENT_DEADLINE_CHANGED` activity row with the actual dates in its metadata would leak the exact thing being hidden.

## 3. Decisions (resolved 2026-08-19)

- **Client visibility**: yes, `CLIENT_PROJECT_SELECT` includes `clientDeadline`.
- **Ordering vs `deadline`**: no constraint, either direction is valid.
- **History**: `AuditLogService` only, no separate history list on the project itself, matching how `user.updated` and other sensitive field changes are already surfaced (`GET /audit-logs`, ADMIN/SYSTEM_ADMIN only).
- **Endpoint shape**: folded into the existing `PATCH /projects/:id` / `UpdateProjectDto`, not a dedicated route. `update()` already does its own per-field diff and log, `deadline` itself gets a separate `DEADLINE_CHANGED` block distinct from the `PROJECT_DETAILS_UPDATED` block covering name/description/plannedStartDate, so `clientDeadline` becomes one more field with its own diff block in the same method, just logged to `AuditLogService` instead of `ProjectActivityService`.

## 4. Architecture (proposed)

### Schema addition: `prisma/schema.prisma`

```prisma
model Project {
  // ...existing fields...
  deadline       DateTime?
  clientDeadline DateTime?
  // ...
}
```

No new enum, no new model. Hand written migration under `prisma/migrations/<timestamp>_add_project_client_deadline/migration.sql` (per CLAUDE.md's non interactive shell note), applied via `prisma migrate deploy`, followed by `prisma generate`.

### DTO change: `src/modules/projects/dto/update-project.dto.ts`

Add one optional field to the existing `UpdateProjectDto`, next to `deadline`:

```ts
@ApiPropertyOptional({ example: '2026-10-05' })
@IsOptional()
@IsDateString()
clientDeadline?: string;
```

No new DTO file, no new route. `PATCH /projects/:id` already takes `PROJECT_STAFF_ROLES` (`PROJECT_MANAGER` +auto `ADMIN`/`SYSTEM_ADMIN`) at the controller and calls `assertManagesProject()` at the top of `ProjectsService.update()`, exactly the access rule this field needs.

### `ProjectsService.update()` changes

`update()` (`projects.service.ts`) already reads `existing` before the write and diffs `name`/`description`/`plannedStartDate` into one `PROJECT_DETAILS_UPDATED` activity log, then separately diffs `deadline` into its own `DEADLINE_CHANGED` activity log. Add `clientDeadline` to the write (`if (dto.clientDeadline !== undefined) data.clientDeadline = new Date(dto.clientDeadline);`), then add a third diff block after the existing `deadline` one:

```ts
if (
  dto.clientDeadline !== undefined &&
  existing.clientDeadline?.getTime() !== updated.clientDeadline?.getTime()
) {
  await this.auditLog.log({
    userId: actorId,
    action: 'project.client_deadline_updated',
    targetType: 'PROJECT',
    targetId: id,
    metadata: {
      from: existing.clientDeadline?.toISOString() ?? null,
      to: updated.clientDeadline?.toISOString() ?? null,
    },
  });
}
```

This is the one field in `update()` that calls `AuditLogService` instead of `ProjectActivityService`, everything else in the method keeps logging to `ProjectActivity` as it does today. `AuditLogService` is `@Global()` already, so `ProjectsService` just needs it injected in the constructor alongside `ProjectActivityService`.

### Read scoping, the real cost of this feature

`findOne`/`findAll`/`findByActiveMembership` (backing both `findMine` and `findForUser`) currently branch two ways: `CLIENT` gets `CLIENT_PROJECT_SELECT`, everyone else gets the full row via `include: PROJECT_INCLUDE` (which returns every scalar column, including any new one, by default). To hide just `clientDeadline` from Developer/Designer while still giving them every other field they see today, `include` cannot be used for that branch anymore, since Prisma cannot mix `include` with excluding a single scalar. This means introducing a third branch:

- `PROJECT_MANAGER` / `ADMIN` / `SYSTEM_ADMIN` → existing full `include: PROJECT_INCLUDE` shape, now naturally includes `clientDeadline` too.
- `DEVELOPER` / `DESIGNER` → new explicit `select` object, call it `STAFF_PROJECT_SELECT`, listing every current `Project` scalar and relation `PROJECT_INCLUDE` already returns, minus `clientDeadline`. This has to be kept in sync by hand if a future field is added, the same maintenance cost `CLIENT_PROJECT_SELECT` already carries as an allowlist.
- `CLIENT` → `CLIENT_PROJECT_SELECT`, now with `clientDeadline` added to it (see rule 4 in §2).
- Every call site that currently does the two way staff/client branch needs the third branch added: `findOne`, `findAll`, `findByActiveMembership` (`findMine`/`findForUser`). `withRemainingHours()` still applies on top unchanged.

`findActivities()` needs no change, since `clientDeadline` changes are never written as a `ProjectActivity` row (see rule 7 in §2).

---

## 5. What Does *Not* Change

- `Project.deadline` keeps its current meaning and every current consumer (dashboard sort, `AdditionalRequirement`/`Blocker` extension math, `DEADLINE_APPROACHING` notification). Nothing here touches that field.
- No new endpoint, no new DTO file, no new `@Roles()` gate to reason about. Same route, same permissions, one more field.
- No new `ProjectActivityType` value. This is intentional, see rule 7.
- No Slack posting. Nothing in `docs/features/slack-integration/DESIGN.md` calls for this, and posting it to a project channel that Developer/Designer can read would defeat the visibility rule anyway.

---

## 6. Status

- [x] Open questions from v0.1 resolved (§3)
- [ ] Schema updated (`clientDeadline` column on `Project`)
- [ ] Migration hand written and applied, client regenerated
- [ ] `UpdateProjectDto` gains `clientDeadline`
- [ ] `CLIENT_PROJECT_SELECT` gains `clientDeadline`
- [ ] `STAFF_PROJECT_SELECT` introduced, three way branch added to `findOne`/`findAll`/`findByActiveMembership`
- [ ] `ProjectsService.update()` writes `clientDeadline` and logs its own diff via `AuditLogService` (inject `AuditLogService` into `ProjectsService`)
- [ ] `CLAUDE.md` / `pixelvega-build-spec.md` updated
- [ ] `npx tsc --noEmit` / `pnpm lint` pass
- [ ] Manual smoke test: PM sets a client deadline via `PATCH /projects/:id`, confirm a Developer's `GET /projects/:id` response has no `clientDeadline` key at all, confirm the Client's own view does, confirm `GET /audit-logs` shows the change
