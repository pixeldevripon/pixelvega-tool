# Internal Review Feature Design

**Version**: 1.0 (as built)
**Status**: Implemented
**Created**: 2026-08-03
**Updated**: 2026-08-03. Controller/module wiring, the generic status endpoint bypass fix, and the CLAUDE.md/pixelvega-build-spec.md updates are all done; see §6.

Written directly from `pixelvega-build-spec.md` (lines 31 to 39, 207 to 210, 555 to 570), following the same approach of writing a draft first used in `docs/features/daily-standups/DESIGN.md` and `docs/features/slack-integration/DESIGN.md`.

---

## 1. Feature Overview

`ProjectStatus` already includes `INTERNAL_REVIEW` and `READY_FOR_CLIENT`, and the generic `PATCH /projects/:id/status` can already move a project through every status in sequence, including these two. What's missing is the **QA gate itself**: nothing records who reviewed the work, how many rounds it took, what the decision was, or what feedback was given. A PM can currently flip `INTERNAL_REVIEW -> READY_FOR_CLIENT` with nothing but a bare `STATUS_CHANGED` activity entry, no different from any other status move.

This feature adds:

1. A `ProjectInternalReview` record created every time a Project Manager reviews work submitted for internal review: reviewer, round number, decision, comments, and timestamp.
2. A dedicated endpoint that is the **only** way to make the `INTERNAL_REVIEW -> READY_FOR_CLIENT` / `INTERNAL_REVIEW -> READY_FOR_WORK` transitions. The generic status endpoint no longer allows either, closing the gap described above.

## 2. Business Rules (as specified)

1. A Developer or Designer moves a project `IN_PROGRESS -> INTERNAL_REVIEW` once their assigned work is complete and ready for review. **Unchanged**, already built via the generic status endpoint (`assertActiveMember`).
2. A Project Manager reviews the submitted work before it is shared with the Client.
3. Every internal review creates a `ProjectInternalReview` record, preserving the complete review history: reviewer, review round, decision, comments, review date. Rounds accumulate and are never overwritten.
4. If the review passes (`APPROVED`), the Project Manager moves the project to `READY_FOR_CLIENT`.
5. If the review requires revisions (`CHANGES_REQUIRED`), the Project Manager moves the project to `READY_FOR_WORK`.
6. A project remains in `READY_FOR_WORK` until a Developer or Designer resumes work, at which point it moves to `IN_PROGRESS` (existing behavior, unchanged).

## 3. Non-Goals for v1

- **Client Review is separate and out of scope here.** `WAITING_FOR_FEEDBACK -> COMPLETED` and the `ClientFeedback` model are a distinct, still unbuilt feature (build spec lines 41 to 53, 572 to 590). Nothing in this design touches that.
- **No Slack posting.** Unlike Blockers/Daily Work Reports, the spec doesn't call for a Slack notification on internal review decisions, and `INTERNAL_FEEDBACK_RECEIVED` isn't listed as a Slack hook point anywhere in `docs/features/slack-integration/DESIGN.md`. Not added here; flag if that's wanted later.
- **No `readyForClientAt` timestamp column.** The build spec lists `Project.readyForClientAt` as `[NOT YET BUILT]`, tied to "the unimplemented Internal/Client Review flow" as a whole rather than internal review specifically. Since `Project.updatedAt` plus this feature's own `ProjectInternalReview.createdAt` already capture when the transition happened, this column isn't added now. It can be revisited once Client Review is built, if a dedicated column turns out to be needed.

## 4. Architecture

### Schema additions: `prisma/schema.prisma` (done)

```prisma
enum InternalReviewDecision {
  APPROVED
  CHANGES_REQUIRED
}

model ProjectInternalReview {
  id        String  @id @default(uuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id])

  reviewedById String
  reviewedBy   User   @relation("ProjectInternalReviewReviewer", fields: [reviewedById], references: [id])

  decision    InternalReviewDecision
  comments    String?
  reviewRound Int

  createdAt DateTime @default(now())

  @@unique([projectId, reviewRound])
  @@index([projectId])
}
```

- `Project.internalReviews ProjectInternalReview[]` relation added.
- `User.internalReviewsGiven ProjectInternalReview[] @relation("ProjectInternalReviewReviewer")` added (mirrors `reviewedAdditionalRequirements`/`reviewedProjectEntries`, already on `User`).
- `ProjectActivityType` gets one new value: `INTERNAL_FEEDBACK_RECEIVED` (name already reserved for this in the build spec).
- Hand written migration `prisma/migrations/20260803090000_add_project_internal_reviews/migration.sql` (per CLAUDE.md's non interactive shell note), applied via `prisma migrate deploy` against the real Neon dev DB, followed by `prisma generate`.

### New service: `InternalReviewsService` (`src/modules/projects/internal-reviews.service.ts`) (done)

Flat inside the existing `ProjectsModule`, following `AdditionalRequirementsService`'s exact shape (`src/modules/projects/additional-requirements.service.ts`) rather than a separate module, per CLAUDE.md's "Module layout" rule: anything needing `ProjectActivityService`/`ProjectMember` checks stays flat in this module.

- `findAll(projectId, query, actorId, actorRole)`: paginated, ordered by `reviewRound` ascending. Read scoping duplicates the existing `assertCanRead` pattern: PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN see any project's history; DEVELOPER/DESIGNER must be an active `ProjectMember`; CLIENT is excluded entirely at the controller `@Roles` level (internal only, same as Additional Requirements).
- `create(projectId, dto, actorId, actorRole)` submits a review decision:
  1. `assertManagesProject` (PM must be actively staffed as PM on this specific project; ADMIN/SYSTEM_ADMIN bypass), the same duplicated helper used everywhere else in this module.
  2. 409 if the project's current status isn't `INTERNAL_REVIEW`.
  3. 400 if `decision === CHANGES_REQUIRED` and `comments` is missing, the same "reason required for this specific outcome" convention as `Blocker.resolutionNotes` (required on resolve) and `ON_HOLD`'s required `reason`, so the developer/designer has something actionable to act on.
  4. `reviewRound = count(existing reviews for this project) + 1`.
  5. Create the `ProjectInternalReview` row.
  6. Update `Project.status`: `APPROVED -> READY_FOR_CLIENT`, `CHANGES_REQUIRED -> READY_FOR_WORK`.
  7. Log `INTERNAL_FEEDBACK_RECEIVED` (metadata: round/decision/comments), then `STATUS_CHANGED` (metadata: `{ from: INTERNAL_REVIEW, to: nextStatus }`), the same shape `ProjectsService.updateStatus()` already logs, so the activity timeline reads identically no matter which endpoint caused the transition.
  8. Return the created review row (with `reviewedBy` included).

### New DTO: `src/modules/projects/dto/create-internal-review.dto.ts` (done)

`CreateInternalReviewDto`: `decision: InternalReviewDecision` (required), `comments?: string` (optional at the DTO level, enforced conditionally in the service per rule 3 above). The list endpoint reuses the existing `PaginationQueryDto`. No extra filters needed.

### New controller: `src/modules/projects/internal-reviews.controller.ts` (done)

`InternalReviewsController`, `@ApiTags('Internal Reviews')`, `@Controller('projects/:projectId/internal-reviews')`:

| Route | Roles | Action |
|---|---|---|
| `GET /` | PROJECT_MANAGER, DEVELOPER, DESIGNER (+auto ADMIN/SYSTEM_ADMIN) | `findAll` |
| `POST /` | PROJECT_MANAGER (+auto ADMIN/SYSTEM_ADMIN) | `create` |

Same `@CurrentUser()`/Swagger annotation shape as `additional-requirements.controller.ts`.

### Closing the bypass: `src/modules/projects/projects.service.ts` (done)

`ALLOWED_STATUS_TRANSITIONS.INTERNAL_REVIEW` changes from `['READY_FOR_CLIENT', 'READY_FOR_WORK', 'CANCELLED']` to `['CANCELLED']`. The two reviewed transitions become reachable only through `InternalReviewsService.create()`. `CANCELLED` is unaffected (still gated to ADMIN/SYSTEM_ADMIN with a required reason via the generic endpoint). `IN_PROGRESS -> INTERNAL_REVIEW` is untouched.

### Module registration: `src/modules/projects/projects.module.ts` (done)

Add `InternalReviewsController` to `controllers`, `InternalReviewsService` to `providers`.

---

## 5. What Does *Not* Change

- The existing `assertActiveMember`/`assertManagesProject` authorization model is reused verbatim (duplicated per service, matching the existing convention across `ProjectsService`/`AdditionalRequirementsService`/`ProjectDocumentsService`), not extracted into a shared helper.
- `IN_PROGRESS -> INTERNAL_REVIEW`, initiated by Developer/Designer, stays on the generic status endpoint. Only the two PM decision transitions move to the new endpoint.
- No changes to `ClientFeedback`/Client Review, fully separate, still unbuilt.

---

## 6. Status

- [x] Schema updated (`InternalReviewDecision` enum, `ProjectInternalReview` model, `INTERNAL_FEEDBACK_RECEIVED` activity type, `Project`/`User` relations)
- [x] Migration hand written and applied (`prisma migrate deploy`), client regenerated (`prisma generate`)
- [x] `CreateInternalReviewDto` written
- [x] `InternalReviewsService` written
- [x] `InternalReviewsController` written
- [x] Registered in `ProjectsModule`
- [x] `ALLOWED_STATUS_TRANSITIONS` updated to close the generic endpoint bypass
- [x] `CLAUDE.md` / `pixelvega-build-spec.md` updated to reflect the new implementation
- [x] `npx tsc --noEmit` / `pnpm lint` pass
- [ ] Manual smoke test (move a project through `INTERNAL_REVIEW` → `APPROVED` → `READY_FOR_CLIENT`, and separately → `CHANGES_REQUIRED` → `READY_FOR_WORK` on a fresh project, confirming `GET .../internal-reviews` returns both rounds in order), not run yet. Left for a real end to end pass against `pnpm start:dev`
