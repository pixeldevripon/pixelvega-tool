# PixelVega PMT

An internal project-management tool for a web agency. It answers the questions an
agency actually has to answer every day: who is on what, how many hours a project
has left, what is blocking it, what the client last said, and who signed off.

Two packages, one repository.

| Package                          | What it is                                                                | Port   |
| -------------------------------- | ------------------------------------------------------------------------- | ------ |
| [`pmt-backend`](./pmt-backend)   | NestJS 11 API. Owns the database, authentication, and every business rule | `5050` |
| [`pmt-frontend`](./pmt-frontend) | Next.js 16 dashboard. A pure API client: no database, no secrets          | `3000` |

---

## Why it exists

An agency's work lives in four or five tools that do not know about each other. A
timesheet does not know a project is blocked. A Slack thread does not know a
deadline moved. A spreadsheet of leave does not know who is staffed on what next
week. The cost is not the tools, it is the reconciling: somebody spends their
Monday morning working out what is true.

This tool holds one record of that, and it is opinionated about two things:

**One place decides.** Every business rule, every permission, and every derived
number lives in the API. There is no second copy in a client to drift out of step
with the first. A status arrives already labelled, a total arrives already summed,
and a button arrives with a flag saying whether this person may press it.

**Nothing is a guess.** Hours come from a timer, not from memory at the end of the
week. A project's status can only move along transitions the server allows. Every
administrative action writes an audit row.

---

## What it does

**Projects and staffing.** Projects carry a status, a priority, a deadline, an
estimate, and a type. Staffing is explicit: a person is a `PROJECT_MANAGER`,
`DEVELOPER` or `DESIGNER` on a given project, and that membership is what grants
access to it. A project moves through a state machine, and only the transitions
the server allows are offered.

**Time tracking.** A timer, not a form: start, pause, resume, stop. One active
timer per person, enforced globally. Meeting time is tracked separately from
project work, because a meeting is not a deliverable. Hours roll up to the project
without anyone adding them.

**Daily work reports.** A plan in the morning, a wrap-up at the end of the day,
per project. The plan locks once the wrap-up is in, and the wrap-up locks two
hours after that: a report is a record of what happened, not a document to keep
tidying. A project manager reviews entries and comments on them.

**Blockers.** Something is in the way, it has a reason, a severity, and an owner.
It ages until it is resolved, and a resolved blocker is locked permanently. If it
cost the project days, that is recorded against the deadline.

**Reviews and client feedback.** Internal review before a client sees anything;
client feedback in rounds after they do. Both move the project's status as a side
effect, so the status cannot say `READY_FOR_CLIENT` without a review existing that
put it there.

**Additional requirements.** Scope that arrived after the estimate did, tracked
separately so it is visible rather than absorbed, with an approval step.

**Leave.** Requests, approvals, balances, holidays, and leave types, so staffing
next week accounts for who will not be there.

**Slack and AI.** Project channels get plan and wrap-up feeds. Claude drafts
project summaries and status reports from the work already recorded, as queued
jobs rather than blocking a request.

**Audit log.** Who did what, to what, and when.

### Roles

`SYSTEM_ADMIN` · `ADMIN` · `PROJECT_MANAGER` · `DEVELOPER` · `DESIGNER` · `CLIENT`

Access is not a role check. Roles map to a set of granular permissions, and the
API gates each endpoint on the permission rather than on the role, so "who may do
this" is one table rather than a condition repeated in thirty places. Whether a
particular person may act on a particular **project** is a separate question,
answered from their staffing.

`CLIENT` is the sharpest edge in the system: a client sees their own projects, in a
reduced projection, and never sees priority, internal reasons, estimates, or
anything about other clients.

---

## How it is built

### Backend

NestJS 11, PostgreSQL through Prisma 7, and better-auth for the entire auth
surface. BullMQ for queued work, Cloudinary for files of any type, the Slack Web
API, and the Anthropic SDK.

Every module has the same shape, and the folder path is the route path, so the
tree tells you the API before you open a controller:

```
src/projects/documents/          ->  /projects/:projectId/documents
├── dto/project-document.dto.ts      every DTO: response, then query, then request
├── spec/                            every spec for this module
├── project-documents.swagger.ts     one composed decorator per endpoint
├── project-documents.service.ts     all the business logic
├── project-documents.controller.ts  routing only
└── project-documents.module.ts
```

Guards run in a fixed order on every request: throttle, then session, then
permissions. The Prisma schema is split by domain rather than kept in one file.

### Frontend

Next.js 16 with the App Router, React 19, Radix primitives and Tailwind 4.
`page.tsx` is a server component; `"use client"` sits at the lowest leaf that
genuinely needs state.

The dashboard performs no computation. It renders what the API returns and sends
what the user typed. If two clients would have to implement the same logic
identically, that logic belongs in the backend.

---

## Getting started

**You need** Node 24, `pnpm`, and a PostgreSQL database. Node 24 is what CI runs;
Prisma 7 accepts `^20.19 || ^22.12 || >=24`. Redis is needed only for the queued
AI jobs, and the app boots without it.

```bash
pnpm install:all                                  # root + both packages

cp pmt-backend/.env.example pmt-backend/.env       # then fill it in, see below
cp pmt-frontend/.env.example pmt-frontend/.env.local

pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm seed                                          # a full, realistic dataset

pnpm dev                                           # API on :5050, dashboard on :3000
```

`pnpm seed` wipes and rebuilds the database, then prints one login per role. Use
it rather than clicking a dataset together by hand.

- API reference: <http://localhost:5050/api/docs>
- Dashboard: <http://localhost:3000>

### The environment variables that are not optional

The API validates its environment at boot and refuses to start on a missing or
placeholder value, so a mistake here is a named error rather than a failure in
whichever feature reads it first.

| Variable                              | Why it is required                                                        |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`                        | Postgres connection string                                                |
| `BETTER_AUTH_SECRET`                  | Signs session cookies and reset tokens                                    |
| `BETTER_AUTH_URL`                     | The API's own origin                                                      |
| `CORS_ORIGINS`                        | Comma separated allowlist. A wildcard is rejected: this API sends cookies |
| `PORT`, `NODE_ENV`                    | `5050` in development                                                     |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME` | The first `SYSTEM_ADMIN`, created once on first boot                      |

Everything else (SMTP, Cloudinary, Redis, Slack, Anthropic) turns a feature on. The
app starts without them and the feature that needs one says so.

There is no public sign-up, by design. An administrator invites a user, who
receives a single-use link that expires in an hour and chooses their own password.
No password is ever emailed.

---

## Working in this repository

```bash
pnpm dev            # both packages
pnpm lint           # eslint --fix
pnpm typecheck      # tsc --noEmit
pnpm test           # backend Jest + frontend Vitest
pnpm build
```

The full gate is `lint · typecheck · test · test:e2e · build`, and `pre-push` runs
it. Every change goes on a branch and lands as a pull request.

**Read [`CLAUDE.md`](./CLAUDE.md) before writing code.** It is the repository's
contract rather than a style guide: it names the conventions, and the handful of
rules where breaking one reopens a bug that has already been closed once.

### Documentation

Everything repository-wide is under [`docs/`](./docs), indexed by
[`docs/README.md`](./docs/README.md).

| Where                                       | What                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| [`docs/architecture/`](./docs/architecture) | The five binding directives, the assessment, the target shapes          |
| [`docs/decisions/`](./docs/decisions)       | Architecture decision records, one per decision worth not re-litigating |
| [`docs/refactor/`](./docs/refactor)         | The nine-phase migration plan, its checklist, and the live progress log |
| `pmt-backend/CLAUDE.md`                     | The backend's own contract, in more detail than the root file           |
| `pmt-backend/pmt-backend-runbook.md`        | How to run and operate the API                                          |

---

## Where the project stands

This repository is mid-migration, and that is deliberate rather than incidental.
The five directives in
[`docs/architecture/02-directives.md`](./docs/architecture/02-directives.md) describe
where the code is going; where existing code disagrees with them, the directive is
right and the code is the defect.

| Area         | State                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------- |
| **Backend**  | Migrated. One module shape, permission gate, split schema, backend-owned derivation and validation |
| **Auth**     | Entirely better-auth's: one catch-all controller, our own guards, invite by link                   |
| **Frontend** | Not yet migrated. Still holds derivation and role checks the directives move to the API            |

[`docs/refactor/03-progress.md`](./docs/refactor/03-progress.md) is the live log:
read it before picking work up, because it carries the decisions and the
deliberate shortcuts that the diff alone does not explain.
