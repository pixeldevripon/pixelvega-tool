---
name: project-scope-remaining-duplicates
description: Snapshot (2026-08-20) of private copies of ProjectScopeService's assertActiveMember/managesProject predicates that still exist outside ProjectScopeService - re-grep before trusting this list.
metadata:
  type: project
---

`ProjectScopeService`'s own doc comment claims twelve prior private copies of
`assertActiveMember`/`managesProject` were replaced. As of the `fix/capabilities-uploads-and-seed`
review (2026-08-20), that migration was still incomplete. This is a snapshot, not a guarantee: re-run
the greps below before citing specific counts, since later PRs may have migrated some of these.

Private copies of the "DEVELOPER/DESIGNER must be an active member to read" pattern (should call
`ProjectScopeService.assertActiveMember`), found via
`grep -rn "You are not an active member of this project" src` minus `scope/project-scope.service.ts`:

- `src/projects/documents/project-documents.service.ts` (`assertCanRead`'s non-CLIENT branch)
- `src/projects/requirements/additional/additional-requirements.service.ts` (`assertCanRead`)
- `src/projects/daily-work-reports/daily-work-report.service.ts` (`assertCanReadProjectEntries`,
  distinct from the `assertCanReview` in the sibling `daily-project-entry.service.ts`, which THIS
  branch did migrate)
- `src/projects/reviews/client/client-feedback.service.ts` (`assertCanRead`'s staff branch)
- `src/projects/reviews/internal/internal-reviews.service.ts` (`assertCanRead`)
- `src/ai/status-report/project-status-reports.service.ts` (`assertCanRead`)

Private copies of the "PROJECT_MANAGER must manage this project" pattern (should call
`ProjectScopeService.managesProject`/`assertManagesProject`):

- `src/projects/reviews/client/client-feedback.service.ts` (`assertCanSubmit`'s PM branch)
- `src/ai/jobs/ai-jobs.service.ts` (`assertCanView`'s PM branch)

Modules confirmed ALREADY migrated and clean (delegate correctly): `src/projects/members/`,
`src/projects/documents/` (write paths), `src/projects/requirements/additional/` (write paths),
`src/projects/reports/project/`, `src/projects/blockers/`, `src/projects/daily-work-reports/` (review
path only).

**How to apply**: when asked "how much of the ProjectScopeService migration is left", re-run the grep
rather than trusting this count verbatim, then diff against this list to report what changed.
