# 0004. The route path is the folder path

**Status:** accepted
**Date:** 2026-08-20

## Context

Route naming is not predictable. Someone who knows one endpoint cannot guess the
next one, and someone reading the folder tree cannot tell what the API looks
like. Four separate problems, all real:

**The folder never predicts the path.** D1 says the folder path mirrors the route
path. Fourteen controllers disagreed with their own folder:

```
src/projects/requirements/additional/  ->  /projects/:projectId/additional-requirements
src/projects/reviews/client/           ->  /projects/:projectId/client-feedback
src/projects/reviews/internal/         ->  /projects/:projectId/internal-reviews
src/projects/blockers/reasons/         ->  /blocker-reasons
src/leave/requests/                    ->  /leave-requests
src/leave/types/                       ->  /leave-types
src/leave/holidays/                    ->  /holidays
src/projects/reports/developer/        ->  /reports/developers
src/projects/time-entries/meeting/     ->  /time-entries       (and the non-meeting routes too)
```

The folders were moved into a nested shape during the phase 7 refactor. The
routes were not moved with them, so every one of those pairs is a promise the
tree makes and the API breaks.

**The same entity has three names.** `PATCH /projects/:id` and
`GET /projects/:projectId/documents` identify the same thing, and Swagger renders
`{id}` and `{projectId}` as unrelated parameters. `:memberId`, `:blockerId`,
`:reportId` and forty bare `:id` params sit alongside each other with no rule.

**One slot holds two entity types.** `PATCH /leave-requests/:id/approve` takes a
LeaveRequest id. `GET /leave-requests/:userId/balance` takes a **User** id. Same
collection, same position in the path, different entity. That is a live footgun,
not a style preference: passing the wrong one gets a 404 that tells you nothing.

**A resource appears twice with no stated rule.** `/blockers` and
`/projects/:projectId/blockers` both exist, as do the two forms of
`daily-work-reports` and `time-entries`. The pattern is defensible and was
deliberate, but it was never written down, so `/reports/developers` sitting at the
top level next to a nested `/projects/:projectId/reports` read as the same kind of
thing when it is not.

## Decision

**One rule, from which everything else follows: the route path is the folder
path.**

`src/<a>/<b>/` serves `/<a>/<b>`. Nothing else needs deciding, because every
question below is answered by looking at the tree.

Four corollaries, each a consequence rather than a separate rule:

### 1. A resource's folder names it

No route segment exists that is not a folder, and no folder serves a route it is
not named for. Adding a sub-resource means adding a folder, and its URL is then
already decided.

### 2. Nested is project-scoped, top level is cross-project and read-only

A resource whose identity requires a project is nested, and **all of its
mutations live there**:

```
POST   /projects/:projectId/blockers          create, on this project
PATCH  /projects/:projectId/blockers/:blockerId
GET    /projects/:projectId/blockers          this project's blockers
GET    /blockers                              across every project, filters as query params
```

The top-level form is a **read-only cross-project view**. It never mutates, and
it takes `projectId` as a query filter rather than a path segment, because it is
answering a different question.

A resource that does not require a project (a daily work report belongs to a
person; a meeting time entry may have no project) is top level and mutates
there.

### 3. Every path parameter is named for the entity it identifies

`:projectId`, `:documentId`, `:blockerId`, `:leaveRequestId`. Never `:id`.

This costs nothing: a path parameter's name is not part of the URL, so renaming
one breaks no client. What it buys is that Swagger stops describing the same
entity under three names, and a reader of a controller can see which id a handler
takes without following the call.

### 4. One entity type per slot

A segment that holds a LeaveRequest id never holds a User id. Where a second
entity is genuinely the subject, it gets its own resource:

```
GET /leave/requests/:leaveRequestId    a request
GET /leave/balances/:userId            a person's balance
GET /leave/balances/me
```

## Consequences

### Breaking, and each one is a folder the routes had drifted from

| From                                           | To                                             |
| ---------------------------------------------- | ---------------------------------------------- |
| `/blocker-reasons`                             | `/blockers/reasons`                            |
| `/leave-requests`                              | `/leave/requests`                              |
| `/leave-types`                                 | `/leave/types`                                 |
| `/holidays`                                    | `/leave/holidays`                              |
| `/leave-requests/:userId/balance`              | `/leave/balances/:userId`                      |
| `/leave-requests/me/balance`                   | `/leave/balances/me`                           |
| `/projects/:projectId/additional-requirements` | `/projects/:projectId/requirements/additional` |
| `/projects/:projectId/client-feedback`         | `/projects/:projectId/reviews/client`          |
| `/projects/:projectId/internal-reviews`        | `/projects/:projectId/reviews/internal`        |
| `POST /blockers`, `PATCH /blockers/:blockerId` | under `/projects/:projectId/blockers`          |

### Folders that move, so the tree stops lying

| From                                 | To                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `src/audit-log/`                     | `src/audit-logs/`                                                                                            |
| `src/ai/status-report/`              | `src/ai/status-reports/`                                                                                     |
| `src/projects/reports/developer/`    | `src/reports/developers/`                                                                                    |
| `src/projects/time-entries/meeting/` | `src/projects/time-entries/meetings/`, and the cross-project reads move to a controller at the resource root |

`reports/developer` is the interesting one: it is not project-scoped, so it does
not belong under `projects/`. Its route was already right and its folder was
wrong, which is the mirror image of the other cases.

### Not breaking, and the largest single win

Forty path parameters are renamed. No URL changes.

### What this costs

The frontend's API client has to follow. It is deferred at the time of writing
and calls several of these endpoints, so it is already out of step; this is the
cheapest moment to make the change rather than the most expensive.

The route permission matrix in `auth/spec/route-permissions.spec.ts` has an entry
per route and is the thing that catches a rename that missed a controller.

## Alternatives considered

**Leave the routes and move the folders instead.** Cheaper (no client change),
but it gives up the nesting the folders were moved into on purpose, and it means
`additional-requirements` stays a flat name for something that is one of several
kinds of requirement.

**Keep both forms of every URL, with the old one redirecting.** Two URLs for one
resource is the problem, not the fix. There is one client, and it is ours.
