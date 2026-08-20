# code-reviewer memory index

One line per memory file: `- [Title](file.md) — hook`. No memory content in this file.

- [Capability flags must share the enforcement predicate](capability-enforcement-shared-predicate.md) — recurring bug class; live instance found in LeaveRequestsService.findAll
- [Remaining ProjectScopeService duplicate predicates](project-scope-remaining-duplicates.md) — 2026-08-20 snapshot of 8 unmigrated private copies, re-grep before citing
- [Service-level wiring often untested](wiring-level-test-coverage-gap.md) — mapper specs are strong, but the service call that builds the context is frequently unverified
- [Two context shapes for per-row capability data](per-entity-context-shape-inconsistency.md) — Map<id,Context> vs shared object + ReadonlySet, neither yet standard
