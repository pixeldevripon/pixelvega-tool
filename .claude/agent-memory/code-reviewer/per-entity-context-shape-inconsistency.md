---
name: per-entity-context-shape-inconsistency
description: Two different, equally valid but inconsistent conventions exist in pmt-backend for giving a list mapper per-row scope information - a Map<id, Context> resolved before mapping vs. a single shared context object carrying a ReadonlySet.
metadata:
  type: project
---

When a list response spans multiple projects and each row needs a per-project boolean (e.g. "does the
caller manage this row's project"), two different shapes are in use:

1. **Map<projectId, Context>, resolved once per distinct id, then `.get(id)` passed into the mapper
   per row.** Used by `ProjectsService.buildProjectContexts` and `BlockerService.buildBlockerContext`
   callers (`findAll`/`findByProject`). The mapper receives one fully-resolved context object scoped
   to exactly its own row; it never sees other rows' ids.

2. **A single shared context object carrying a `ReadonlySet<string>` of ids the caller manages, plus
   `callerId`, passed identically to every row; the mapper itself does the `.has(row.projectId)`
   lookup.** Introduced in `daily-work-report.mapper.ts`'s `WorkReportContext.managedProjectIds` (the
   `fix/capabilities-uploads-and-seed` branch, 2026-08-20).

Both are defensible (the module CLAUDE.md's "mapper is pure: row + context" rule permits either), and
the `ReadonlySet` variant is arguably cleaner (avoids the `as BlockerContext` non-null cast that shape
1 needs at `contexts.get(item.projectId) as BlockerContext`). But they are inconsistent, and D1 asks
for one shape everywhere. Neither has been declared the standard.

**How to apply**: if asked to pick one, recommend the `ReadonlySet`/shared-context-object shape for
new code (it is more type-safe, no cast needed), but flag existing shape-1 call sites only as an
observation, not a defect, until the project explicitly picks a standard. Do not treat either shape
alone as a finding; only flag it when a new module invents a THIRD shape.
