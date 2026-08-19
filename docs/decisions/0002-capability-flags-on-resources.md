# 0002. Capability flags are per action, in a capabilities object

**Status:** accepted
**Date:** 2026-08-20

## Context

The frontend assembles 39 `canX` booleans from 70 role string comparisons:

```ts
const canManageProjects =
  currentUser?.role === "SYSTEM_ADMIN" ||
  currentUser?.role === "ADMIN" ||
  currentUser?.role === "PROJECT_MANAGER";
```

This is a second copy of `ROLE_PERMISSIONS`, and it is already divergent: when
`REVIEW_LEAVE_REQUEST` moved to admin only in phase 4, nothing in the frontend
noticed.

Two questions: what shape, and how fine grained.

## Decision

**Two mechanisms, because one question is not the other.**

1. **`GET /users/me/permissions`** answers "may this role ever do this". Already
   built. `RoleContext` feeds `can()` and `canAny()` from it, and never from a
   role string.

2. **A `capabilities` object on each resource** answers "may THIS caller do it to
   THIS record", which a permission alone cannot, because it depends on
   `ProjectMember` rows, on the record's current status, and sometimes on a clock:

```json
{
  "id": "...",
  "status": {
    "value": "IN_PROGRESS",
    "label": "In progress",
    "tone": "primary"
  },
  "capabilities": {
    "canEdit": true,
    "canChangeStatus": true,
    "canArchive": false,
    "canDelete": false
  }
}
```

**Granularity: per action, not per resource and not per endpoint.**

- One `canEdit` covering everything is too coarse. The UI genuinely gates archive
  separately from edit, and a PM can edit a project they cannot archive.
- One flag per endpoint is too fine. It couples the response to the route table
  and grows without bound.
- Per action, **and only for actions the UI actually gates**, is the useful
  middle. This follows Google Drive's `capabilities` model, which is the mature
  version of this pattern; GitHub's coarser `permissions: { admin, push, pull }`
  is role shaped and would reintroduce exactly the coupling being removed here.

A flag is added when a screen needs it, not speculatively.

**The flags are advisory, never the control.** The server still enforces every
rule in the guard and the service. A client that ignores them gets a 403. They
exist so the UI does not offer an action that will fail.

## Consequences

**Easier.** The client stops re-deriving authorization. Rules that depend on
record state, the two hour wrap up edit window, the permanent lock on a resolved
blocker, become expressible to the UI at all, which they are not today.

**Harder.** Each resource's service must compute its flags, which means the scope
checks that currently run only on write now also run on read. Where that costs a
query, it should reuse the one already loaded rather than adding another.

**Ruled out.** `canX` booleans derived in a component. Role string comparisons
outside `RoleContext`. Both become lint errors under the presentation only rule.

**The sharpest case this fixes:** `canEditWrapUp` currently re-implements the two
hour edit window in the browser, where the clock can disagree with the server's.
