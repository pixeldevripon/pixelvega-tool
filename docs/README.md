# PixelVega PMT documentation

Every repo-wide document lives here, organized by folder. Package-specific documentation stays with
its package (`pmt-backend/docs/`, `pmt-backend/pmt-backend-runbook.md`).

**Docs are Markdown.** An HTML build is produced only on explicit request, and is never the source of
truth when one exists.

---

## Reading order

Numbered prefixes are the reading order, not a category.

### `architecture/`

| Doc                                                                     | What it answers                                                                                                              |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [`01-assessment.md`](./architecture/01-assessment.md)                   | Where the codebase stands today, measured against the reference repos. The gap register with severities                      |
| [`02-directives.md`](./architecture/02-directives.md)                   | **The five binding constraints.** Read this before writing any code                                                          |
| [`03-target-architecture.md`](./architecture/03-target-architecture.md) | The shapes every module lands in: backend module template, shared infrastructure, frontend module template, lint enforcement |

### `refactor/`

| Doc                                             | What it answers                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`01-plan.md`](./refactor/01-plan.md)           | The nine phases, their order and dependencies, exit criteria, risks, open questions               |
| [`02-checklist.md`](./refactor/02-checklist.md) | The same work as 185 tickable items. **Tick it in the same PR as the work**                       |
| [`03-progress.md`](./refactor/03-progress.md)   | **The live execution log.** What is being worked right now, in order, with outcomes and decisions |

---

## If you only read one thing

[`architecture/02-directives.md`](./architecture/02-directives.md). Five constraints govern every
change in this repo:

|        | Directive                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| **D1** | The backend **mirrors** `../island-tour-development/backend`. Modules at `src/<module>/`, no `modules/` wrapper |
| **D2** | Authorization is a granular permission gate: `@RequirePermissions()`, not `@Roles()`                            |
| **D3** | The Prisma schema is split by domain                                                                            |
| **D4** | The backend serves everything. The frontend performs no computation, transformation, or derivation              |
| **D5** | Validation is owned by the backend. The DTO is the specification                                                |

The short form of all of it is in the root [`CLAUDE.md`](../CLAUDE.md), which every Claude Code
session loads automatically.

---

## Where a new doc goes

| Kind of doc                                    | Location                                                        |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Repo-wide architecture, decisions, conventions | `docs/architecture/`                                            |
| Refactor and migration planning                | `docs/refactor/`                                                |
| An architecture decision record                | `docs/decisions/`, one file per decision, `NNNN-short-title.md` |
| A feature's design or business rules, backend  | `pmt-backend/docs/features/<feature>/`                          |
| A feature's design, frontend                   | `pmt-frontend/docs/features/<feature>/`                         |
| How to run or operate something                | the package's `README.md` or runbook                            |
| Instructions to Claude Code                    | a `CLAUDE.md`, never a doc under `docs/`                        |

Keep the doc in the same PR as the change it describes. A doc that lags the code is worse than no
doc, because the next reader trusts it.
