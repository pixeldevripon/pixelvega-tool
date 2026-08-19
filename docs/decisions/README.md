# Architecture decision records

One file per decision, named `NNNN-short-title.md`, numbered in the order they were taken. A decision
belongs here when a future reader would otherwise re-litigate it.

Keep each one short: the context, the decision, and the consequences. If it takes more than a page,
the detail belongs in `docs/architecture/` and the ADR links to it.

```markdown
# NNNN. Title

**Status:** accepted | superseded by NNNN | proposed
**Date:** YYYY-MM-DD

## Context

What forced a decision. The constraint, not the history.

## Decision

What was decided, in the active voice.

## Consequences

What this makes easy, what it makes hard, and what it rules out.
```

Four are owed, per phase 9 of the refactor plan: the permission gate (D2), the presentation only
frontend (D4), backend owned validation (D5), and the mirror directive itself (D1).
