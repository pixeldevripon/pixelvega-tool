---
name: wiring-level-test-coverage-gap
description: Recurring test-quality gap in pmt-backend - mapper specs are excellent and branch-complete, but the service method that assembles the mapper's context object often has zero test covering that assembly.
metadata:
  type: project
---

Observed across the `fix/capabilities-uploads-and-seed` diff (2026-08-20): when a capability flag is
fixed by threading a new context value (`managedProjectIds`, `mayChangeStatus`, actor-vs-subject
split) from a service method into a mapper, the mapper-level spec is consistently rewritten to cover
every branch with real value assertions (this repo does this well: see
`daily-work-report.mapper.spec.ts`, `blocker.mapper.spec.ts`, `cloudinary.service.spec.ts` for the
standard to hold new specs to). But the SERVICE method that actually computes the context value and
passes it to the mapper is frequently left with its pre-existing spec file untouched, and that spec
often does not exercise the new wiring at all - so if the wiring were deleted (e.g. the service passed
`{ callerId }` without `managedProjectIds`), no test would fail.

Concrete instances found in that review: `ProjectsService.findForUser`'s actor-vs-subject split (zero
coverage anywhere in `src/`), `ProjectsService.updateStatus`'s new
`assertMayChangeProjectStatus`/`mayChangeStatus` scoping branch (the existing
`projects.service.spec.ts` mocks `projectMember.findFirst` to always resolve truthy by default, so
the forbidden branch is never exercised), `DailyWorkReportService.findByProject` /
`findAllForUser`'s `managedProjectIds` computation and threading (the existing
`daily-work-report.service.spec.ts` covers only the plan/wrap-up edit-window logic, not these two
list methods at all).

**How to apply**: when a spec diff shows a mapper spec was thoroughly rewritten but the sibling
service spec was NOT touched, check whether the service spec's existing mocks default to a
permissive value (e.g. `projectMember.findFirst` resolving `{ id: 'm1' }` by default) that would mask
the new logic being deleted entirely. That combination (untouched spec + permissive default mock) is
the signature of a test that cannot fail. Flag it even when the mapper-level tests are strong, since
mapper tests alone cannot prove the service actually calls the mapper with the right context.
