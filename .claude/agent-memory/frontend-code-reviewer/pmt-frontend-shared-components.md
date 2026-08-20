---
name: pmt-frontend-shared-components
description: Validated shared components/hooks in pmt-frontend that should be reused rather than re-implemented per module
metadata:
  type: project
---

Confirmed-good shared seams in `pmt-frontend/components/common/` as of the `feat/cross-project-queues`
review (2026-08-20):

- `components/common/filter-select.tsx` (`FilterSelect`): the dropdown-filter-that-can-be-cleared
  primitive. Sentinel (`__any__`) never leaves the file. Correctly adopted by blockers, leave, users
  list views. `components/projects/projects-filters.tsx` keeps a second, file-local sentinel
  (`DEFAULT_ORDER`) for its sort control because that control needs a real selectable "default" value
  rather than a "clear" affordance; this is a deliberate, documented distinction, not confusion. Don't
  suggest merging the two.
- `components/common/person-cell.tsx` (`PersonCell`): avatar + name + secondary line. Correct home for
  "how do we show a person in a table cell" across modules. NOT yet adopted by three pre-existing
  hand-rolled call sites that duplicate the exact same `name.slice(0, 2).toUpperCase()` initials
  formula: `components/projects/project-lead-avatar.tsx` (x2), `components/home/project-card.tsx`,
  `components/common/stats/ranked-list.tsx`. Worth flagging as a follow-up whenever one of those files
  is touched again.
- `components/common/date-cell.tsx` (`DateCell`): `Intl`-only date/time rendering, correctly kept out of
  business-rule territory (derived fields like age/resolution time come from the API as
  `ageLabel`/`resolutionLabel`, never computed here).
- `lib/api/humane-error.ts` exists and documents itself as "the single place technical API failures
  become words a user can act on," but as of this review there is no exported helper for the
  `error instanceof Error ? error.message : 'Please try again.'` ternary used in list-view empty
  states. That ternary is duplicated across `components/projects/projects-view.tsx`,
  `components/home/home-view.tsx`, and (after `feat/cross-project-queues`) the four new
  `*-list-view.tsx` files (blockers, leave, users, audit-logs) — 6 instances. A `queryErrorMessage()`
  export from `lib/api/humane-error.ts` would collapse all of them.

Test/fixture convention: fixtures and tests for a module belong colocated with that module
(`components/<module>/<module>.fixture.ts`, precedent: `components/projects/projects.fixture.ts`), not
under `components/common/`. `components/common/` is for shared production UI only.
