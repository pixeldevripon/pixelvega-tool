---
name: pixelvega-trust-model-notes
description: Confirmed trust-boundary facts and recurring miss classes for pixelvega-tool pmt-backend/pmt-frontend, learned across security reviews
metadata:
  type: project
---

## Confirmed, current (checked 2026-08-20 on refactor/route-path-is-folder-path)

- `pmt-backend/src/main.ts` already has BOTH `whitelist: true` AND `forbidNonWhitelisted: true` on
  the global `ValidationPipe`. This is more current than the generic "silently strips unknown
  fields" trust-model description sometimes assumed for this class of app: in THIS repo an unknown
  body field is a 400, not a silent drop. Re-verify at `pmt-backend/src/main.ts` before assuming
  the strip-vs-reject behavior either way, since this could change again.
- Blocker scoping: `BlockerService.getBlockerOrThrow(projectId, blockerId)` uses
  `findFirst({ where: { id: blockerId, projectId } })`, so a blocker id from project A 404s when
  addressed through project B's path. This is deliberately covered by a spec that asserts the exact
  `where` clause (`blocker.service.spec.ts`, "scopes the lookup by BOTH the project and the blocker").
  Good pattern to point to when checking future path-scoped resources.
- `route-permissions.spec.ts` (`pmt-backend/src/auth/spec/`) reads Reflect metadata via
  `collectRouteGating`, not source text, and has structural assertions beyond the EXPECTED map:
  every route must appear in both directions, nothing may be `UNGATED`, nothing may be `PUBLIC`.
  This means a controller that dropped its permission decorator entirely fails the suite (it
  would show as UNGATED), so a "regenerated matrix" in this repo is a meaningfully strong check, not
  just a rubber stamp. Still diff old vs new EXPECTED entries when reviewing a route rename, since
  that catches a permission that changed VALUE (not just one that vanished).
- Ownership-only, admin-not-exempt rules confirmed still true after the phase 6c route rename:
  leave-request `cancel` (`LeaveRequestsService.cancel`, requester id checked against the row) and
  blocker edit for the ORIGINAL REPORTER path (`assertCanUpdate`: reporter needs to still be an
  active project member; ADMIN/SYSTEM_ADMIN bypass that specific membership re-check but a PM does
  not). Time-entry pause/resume/stop (project and meeting) pass `user.id` straight into the service
  with no separate admin bypass path observed in the controllers reviewed so far.

## Confirmed, current (checked 2026-08-20 on feat/cross-project-queues)

- **Role-scoped status intersection pattern, confirmed correct.**
  `LeaveRequestsService.findAll` (`pmt-backend/src/leave/requests/leave-requests.service.ts`) adds a
  caller-supplied `status` filter alongside the pre-existing PROJECT_MANAGER-can't-see-REJECTED rule.
  Implemented as `visibleStatuses.filter(allowed => allowed === status)` (an intersection), not a
  spread that could overwrite the role clause. Asking for an out-of-scope status yields `status: {
in: [] }` (matches nothing) rather than a 403, deliberately, so the response does not confirm which
  statuses exist. This is the reference shape for any future "add a caller filter next to an existing
  role-restricted enum clause" change: intersect, do not let the caller's value replace the role's.
  `getSummary`/`getSummaryCsv` were untouched by that PR and stay safe by construction because they
  hardcode `status: 'APPROVED'` rather than taking a caller-supplied status at all.
- **Mapper-maps-field-by-field-never-spreads is now the pattern in three places**, each with a spec
  that asserts a spread-shaped attack still cannot leak `User.password`: `leave.mapper.ts`
  (`toLeaveUser`), `audit-log.mapper.ts` (`toAuditLogResponse`), and the pre-existing `user.mapper.ts`.
  Each one has a test that deliberately feeds `password: 'a-real-bcrypt-hash'` into the mapper input
  and asserts it does not appear in `Object.keys(response.x)`. This is a good defense-in-depth check
  to ask for whenever a new mapper is added for a relation that ultimately points at `User`.
- **Cross-project list scope clause + caller filters, confirmed non-overridable by construction, not
  by key ordering.** `BlockerService.findAll`'s DEVELOPER/DESIGNER membership scope
  (`project: { members: { some: { userId, leftAt: null } } } }`) and the caller-supplied `projectId`/
  `assignedToId`/`search` filters are DIFFERENT top-level Prisma `where` keys, built from named
  destructured DTO fields (never `...query` spread), so there is no key collision to exploit even
  though the code comments frame the scope clause's LAST position as the safety property. The actual
  safety property is: (1) distinct keys AND on the same object, (2) the scope clause is derived from
  `actorId`/`actorRole` off the session, never from the query DTO, and (3) `count()` reuses the exact
  same `where` as `findMany()`, so a caller cannot use a filter (or the total count) to detect the
  existence of a row outside their scope. Check for exactly those three properties on the next
  cross-project list endpoint, not merely "is the scope clause last in the object literal."

## Recurring miss class seen in this codebase

- **A route-rename PR can do a correct mechanical prefix substitution everywhere except one
  resource that actually MOVED to a new controller.** Found in
  `pmt-frontend/lib/api/leave.ts`, `listBalanceForUser(userId)`: the backend split
  `GET /leave-requests/:userId/balance` out into a new `LeaveBalancesController` at
  `GET /leave/balances/:userId`, but the frontend caller was updated with the same blanket
  `leave-requests` -> `leave/requests` string substitution used for every other leave-requests call,
  landing on `/api/leave/requests/${userId}/balance`, which matches no route in
  `LeaveRequestsController` and 404s. Not exploitable (fails closed), but it silently breaks a
  PM/admin-facing feature (viewing a requester's balance while reviewing their leave request,
  `components/dashboard/leave-requests-view.tsx`). No frontend test exists for `lib/api/leave.ts`,
  which is why it was not caught before review. When a backend split spawns a NEW controller for
  part of an old resource, check every frontend caller of the OLD path individually rather than
  trusting a global find/replace to have followed the split.
- When a diff's stat shows a file as "new" (100% added) for what the PR description calls a
  "rename", check `git show main:<old-path>` and diff it against the new file directly
  (`diff <(git show main:old) <(cat new)`) rather than trusting git's stat rename detection: several
  files in this diff (`AuditLogController`, `ProjectStatusReportsController` and siblings) showed as
  full adds in `git diff main...HEAD --stat` even though they were byte identical except import
  paths. Renaming a file's containing folder without `git mv` is enough to lose rename detection at
  default similarity thresholds when combined with other changes in the same commit.
