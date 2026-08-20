---
name: capability-enforcement-shared-predicate
description: The recurring PixelVega defect class - a response capability flag re-derives an authorization rule instead of sharing the exact predicate the service enforces - and where it is still unfixed as of 2026-08-20.
metadata:
  type: project
---

The single most common defect class in this backend: a mapper's `can*` capability flag is computed
by re-implementing an authorization rule (role check, membership check) rather than calling the exact
same predicate the service's `assertCanX` uses to enforce it. When the two are written twice, they
drift silently and the frontend (which gates purely on the flag, per D4) offers a control that then
403s.

The `fix/capabilities-uploads-and-seed` branch (reviewed 2026-08-20) fixed four instances of this by
introducing single boolean predicates on `ProjectScopeService` (`mayChangeProjectStatus`) or by
threading a context value (`managedProjectIds`, `callerId`) from the same service call the assertion
uses, then having the mapper read that value instead of recomputing it. See
`ProjectScopeService`'s own doc comment for the full rationale (it replaced twelve prior private
copies of `assertActiveMember`/`assertManagesProject`).

**As of that review, this class of bug still has at least one confirmed live instance outside the
diff's scope**: `LeaveRequestsService.findAll` (`src/leave/requests/leave-requests.service.ts`, the
`const context = { callerId: actorId, canReviewLeave: true };` line) hardcodes `canReviewLeave: true`
for every role that reaches the endpoint. `PROJECT_MANAGER` holds `Permission.VIEW_LEAVE_REQUESTS`
(reaches this list) but NOT `Permission.REVIEW_LEAVE_REQUEST` (confirmed in
`src/config/roles.config.ts`'s `PROJECT_MANAGER` array, which excludes it; only the `ADMIN` array adds
it). A PROJECT_MANAGER therefore sees `capabilities.canApprove: true` on a pending leave request and
gets a 403 from `PATCH /leave-requests/:id/approve`, which is gated by
`@RequirePermissions(Permission.REVIEW_LEAVE_REQUEST)`. Verify this is still true before citing it (a
future PR may have fixed it); the fix is to derive `canReviewLeave` from the actual permission set
(inject `PermissionsService`, or pass `actorRole` and check it) rather than a role-agnostic literal.

**How to apply**: whenever reviewing a mapper's `capabilities`/`can*` block in this repo, always find
the sibling service's enforcement for that same action and confirm the flag is LITERALLY the same
boolean/value the enforcement reads, not a re-derived approximation. Cross-check against
`ROLE_PERMISSIONS` in `roles.config.ts` specifically for "does every role that can reach this list
endpoint also hold the permission the mutation route requires" - that asymmetry is exactly how the
leave module bug happened, and it is worth checking on every list endpoint that hardcodes a
capability rather than computing it per caller.

See also [[project-scope-remaining-duplicates]] for the count of remaining private predicate copies,
and [[wiring-level-test-coverage-gap]] for why this class of bug is easy to ship undetected.
