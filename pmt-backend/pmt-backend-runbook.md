# PMT Backend Runbook

How to set up this API from a fresh clone, fill it with test data, and sign in as every role.

Follow the sections in order the first time. After that, jump to [Seed the database](#4-seed-the-database) or [Test credentials](#5-test-credentials).

> **The seed deletes data.** `pnpm seed` empties every application table before it writes anything. Only point it at a local or development database. It refuses to run when `NODE_ENV=production` unless you pass `--force`.

---

## 1. Prerequisites

| Tool | Version | Required | Notes |
| --- | --- | --- | --- |
| Node.js | 20.9 or newer | Yes | Verified on 24.11. Prisma 7 needs 20.9 at minimum. |
| pnpm | Any recent release | Yes | Verified on 11.10. This repo uses pnpm, not npm or yarn. |
| PostgreSQL | 14 or newer | Yes | A Neon database works and is what this project uses. |
| Redis | 7 or newer | Only for AI jobs | Without it the app still boots, but the two queued AI features fail. |

Everything else is optional and only unlocks one feature at a time. See the table in section 3.

---

## 2. Install

```bash
git clone https://github.com/pixelvega-limited/pmt-backend.git
cd pmt-backend
pnpm install
```

`pnpm install` runs `prisma generate` for you through the `postinstall` script, so the Prisma client is ready straight away. If you ever see `Cannot find module '@prisma/client'`, run `npx prisma generate` by hand.

---

## 3. Configure the environment

Copy the template and fill it in:

```bash
cp .env.example .env
```

`.env` is gitignored. Never commit it, and never paste real values into a ticket or a chat.

Generate the auth secret with:

```bash
openssl rand -base64 32
```

### What each variable does

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. Everything reads and writes through this. |
| `BETTER_AUTH_SECRET` | Yes | Signs sessions and reset tokens. Use the `openssl` command above. |
| `BETTER_AUTH_URL` | Yes | Base URL used in invite emails as the login link. Defaults to `http://localhost:5050`. |
| `PORT` | No | HTTP port. Defaults to `3000`. |
| `NODE_ENV` | No | Set to `production` only in a real deployment. It tightens the auth origin check and blocks the seed. |
| `CORS_ORIGIN` | No | Frontend origin. Falls back to `*`. Needed with credentials so the session cookie is sent. |
| `ADMIN_EMAIL` | Yes | Email of the single root `SYSTEM_ADMIN`. Used by the seed and by the on-boot bootstrap. |
| `ADMIN_NAME` | Yes | Display name for that account. |
| `ADMIN_PASSWORD` | Yes | Password for that account, at least 8 characters. It is the one account not invited by email, because nobody can invite anyone until it can sign in. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | No | Outgoing mail for invites and password reset codes. Leave blank to skip sending email. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | No | Image and document storage. Needed only for real file uploads. |
| `SLACK_BOT_TOKEN` | No | Slack bot token. Every Slack call fails safely and is logged when this is missing. |
| `SLACK_DAILY_FEED_CHANNEL_ID` | No | Channel id, not the name, for the combined daily plan and wrap up feed. |
| `ANTHROPIC_API_KEY` | No | Needed for the scope checker, project summary, and AI status report. |
| `REDIS_URL` | No | Job queue behind the scope checker and status report. The app boots without it and fails the first job instead. |

Keep `.env.example` in step whenever a new variable is introduced. It is the checked in source of truth for the list above.

---

## 4. Seed the database

### 4.1 Create the schema

You can skip this step. `pnpm start:dev` runs `prisma migrate deploy` first through a `pre` script, so pointing `DATABASE_URL` at an empty database and starting the app is enough to create every table.

To do it on its own:

```bash
npx prisma migrate deploy
```

Use `migrate deploy`, not `migrate dev`. `migrate dev` needs a real terminal and refuses to run whenever it wants to ask a yes or no question.

### 4.2 Run the seed

```bash
pnpm seed
```

Three commands reach the same script, so pick whichever fits:

| Command | What it does |
| --- | --- |
| `pnpm seed` | Empties every application table, then writes the full dataset. The one you want day to day. |
| `pnpm seed:reset` | `prisma migrate reset --force`. Drops the schema, reapplies all migrations, then seeds. Use this when a migration is wrong. |
| `npx prisma db seed` | Same script, driven by `migrations.seed` in `prisma.config.ts`. |

It takes under a second against a local Postgres, and a few seconds against a hosted Neon database. The script prints its progress, a row count per table, and the credentials table as it finishes.

`_prisma_migrations` is never touched, so your migration history survives a seed.

### 4.3 What you get

A small dataset on purpose: 33 users and 20 projects, sized so a screen can be read end to end rather than only paginated through. Counts from a verified run:

| Table | Rows | | Table | Rows |
| --- | --- | --- | --- | --- |
| `User` | 33 | | `ProjectActivity` | 253 |
| `EmployeeProfile` | 23 | | `TimeEntry` | 192 |
| `ClientProfile` | 10 | | `MeetingTimeEntry` | 74 |
| `account` | 33 | | `AdditionalRequirement` | 28 |
| `session` | 24 | | `DailyWorkReport` | 78 |
| `verification` | 12 | | `DailyProjectEntry` | 142 |
| `AuditLog` | 80 | | `BlockerReason` | 32 |
| `LeaveType` | 14 | | `Blocker` | 28 |
| `Holiday` | 35 | | `ProjectInternalReview` | 14 |
| `LeaveRequest` | 40 | | `ClientFeedback` | 9 |
| `LeaveBalance` | 127 | | `AiTemplate` | 4 |
| `Project` | 20 | | `AiJob` | 29 |
| `ProjectTypeTag` | 38 | | `ProjectStatusReport` | 28 |
| `ProjectMember` | 83 | | `Notification` | 60 |
| `ProjectDocument` | 50 | | | |

Users are capped per role, and each cap counts that role's fixed test account: 3 `ADMIN`, 4 `PROJECT_MANAGER`, 10 `DEVELOPER`, 5 `DESIGNER`, 10 `CLIENT`, plus the one root account.

The 20 projects are two in each of the ten statuses, so every filter, every report, and every stage of the workflow has rows behind it and none of them is empty.

The seed no longer aims for 100 rows a table. It warns about an EMPTY table instead: a count in single figures is the intent now, while a count of zero means a seeder ran and wrote nothing, which is a defect rather than a setting.

Every seeded person also has a real profile photo, so the dashboard shows faces rather than initials everywhere. The URLs are hotlinked portraits, not Cloudinary assets, so `avatarPublicId` is deliberately null on every seeded row.

Reseeding is repeatable. The same random seed always produces the same rows and the same ids, so a Postman collection can keep real ids as default variable values. Changing any row count in `prisma/seed/config.ts` shifts those ids, so reseed and refresh your saved ids together.

---

## 5. Test credentials

Six accounts, one per role. They are always `ACTIVE`, always email verified, and never asked to reset their password, so they work the moment the seed finishes.

| Role | Email | Password |
| --- | --- | --- |
| `SYSTEM_ADMIN` | `ADMIN_EMAIL` from your `.env` | `ADMIN_PASSWORD` from your `.env` |
| `ADMIN` | `ops-admin@pixelvega.com` | `Password123!` |
| `PROJECT_MANAGER` | `pm@pixelvega.com` | `Password123!` |
| `DEVELOPER` | `developer@pixelvega.com` | `Password123!` |
| `DESIGNER` | `designer@pixelvega.com` | `Password123!` |
| `CLIENT` | `client@pixelvega.com` | `Password123!` |

> The five below the root one are test fixtures for a seeded development database. They are deliberately weak and publicly documented. Never create them in a production environment.

The root account is entirely yours: `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` in `.env` decide it, the seed refuses to start if any of the three is missing, and the report at the end prints the email but never the password. The same three variables drive `SystemAdminBootstrapService`, which creates the identical account on first boot in an environment the seed never runs in.

The other five are fixed in `prisma/seed/config.ts`. The `ADMIN` one is `ops-admin@`, not `admin@`, because `ADMIN_EMAIL` is usually `admin@pixelvega.com` and the root account claims its address first.

Neither delete route will remove the root account: `DELETE /users/:userId` answers 403 with "The system admin account cannot be deleted", and `DELETE /profiles/me` answers 403 with "There must always be a root account". The seed will not soft delete it either.

### Each account has real data

The first 6 projects are wired to these accounts, so none of them opens onto an empty dashboard:

| Account | What it can see |
| --- | --- |
| `SYSTEM_ADMIN`, `ADMIN` | Everything company wide, plus its share of the 60 notifications. |
| `PROJECT_MANAGER` | Runs the 6 test projects. Has meeting hours, daily reports, and leave requests. |
| `DEVELOPER` | Staffed on the test projects and usually a few more. Has time entries, daily reports, and a leave balance. |
| `DESIGNER` | Same shape as the developer. |
| `CLIENT` | Owns the 6 test projects, and sees only the reduced client view of each. |

### Every other account works too

Every seeded account except the root one shares `Password123!`, so you can sign in as anyone to test a specific case. Three things to know:

- Some generated accounts are `INVITED` on purpose. They can sign in, and the first successful login flips them to `ACTIVE`.
- Some are `SUSPENDED` on purpose. Signing in as one returns `403` with `ACCOUNT_SUSPENDED`, which is the app working correctly, not a broken seed.
- A few accounts are soft deleted and are hidden from `GET /users`, while their past project data stays in place.

---

## 6. Start the app and sign in

```bash
pnpm start:dev
```

Swagger UI is at `http://localhost:5050/api/docs`, and the raw spec is at `/api/docs-json`.

Sign in from the command line:

```bash
curl -s -c cookies.txt -X POST http://localhost:5050/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"pm@pixelvega.com","password":"Password123!"}'
```

Then reuse the cookie on any request:

```bash
curl -s -b cookies.txt "http://localhost:5050/api/projects/mine?pageSize=5"
```

The session lives in a `better-auth.session_token` cookie. In Postman, sign in once and let the built in cookie jar carry it. Do not set a `Cookie` header by hand.

---

## 7. Check that it worked

Sign in as the project manager, then run these. All five should return `200` with real rows:

```bash
curl -s -b cookies.txt "http://localhost:5050/api/projects/mine?pageSize=3"
curl -s -b cookies.txt "http://localhost:5050/api/leave-requests?pageSize=3"
curl -s -b cookies.txt "http://localhost:5050/api/blockers?pageSize=3"
curl -s -b cookies.txt "http://localhost:5050/api/notifications/unread-count"
curl -s -b cookies.txt "http://localhost:5050/api/daily-work-reports?pageSize=3"
```

Two results that look like failures but are correct:

- `GET /projects/mine` returns nothing for `SYSTEM_ADMIN` and `ADMIN`. Admins are never staffed onto a project, because their access is unscoped already.
- The client account gets `403` on `/projects/:id/internal-reviews` and `/projects/:id/time-entries`. Both are internal views a client is not meant to read.

---

## 8. What the seed guarantees

The seed reproduces the rules the service layer enforces, not just the column types. It matters because the read endpoints assume these hold:

- `Project.actualHours` equals the summed minutes of every ended time segment divided by 60.
- Approved additional requirements and resolved blockers are added on top of `estimatedHours` and `deadline`, the same additive way the app applies them.
- A `RUNNING` time entry has no end time and no duration, sits on the current day, and never coexists with a second running timer for the same person across project time and meeting time.
- `LeaveBalance.usedDays` equals the summed days of that person's approved requests for that year and leave type.
- Internal review rounds and client feedback rounds start at 1 and never skip a number.
- A project waiting on client feedback has no feedback rows yet, because the first round is what would move it out of that status.
- A project still in planning has a manager but no developer or designer, because gaining both is what moves it forward.

If you add a feature, extend the matching seed module so new rows keep these true.

---

## 9. Change the data volume

Everything is driven by `prisma/seed/config.ts`. Common knobs:

| Setting | Meaning |
| --- | --- |
| `VOLUME.projects` | How many projects to create. Drives most other counts. |
| `VOLUME.clients`, `VOLUME.developers`, `VOLUME.designers`, `VOLUME.projectManagers`, `VOLUME.admins` | Account counts per role. Employee and client profiles are one per person, so each group needs 100 or more for both profile tables to clear 100. |
| `VOLUME.timeTrackingDays`, `VOLUME.workReportDays` | How far back the work history runs. |
| `SEED_PASSWORD` | The shared password. |
| `SEED_TODAY` | The fixed date history is built backwards from. |
| `RANDOM_SEED` | Change it for a different but still repeatable dataset. |
| `GUARANTEED_TEST_PROJECTS` | How many projects the test accounts share. |

Layout of the seed:

| Path | Role |
| --- | --- |
| `prisma/seed.ts` | Entry point. Wipes, calls each module in order, prints the report. |
| `prisma/seed/config.ts` | Volumes, password, dates, test accounts. |
| `prisma/seed/random.ts` | The repeatable random generator and date helpers. |
| `prisma/seed/pools.ts` | Names, companies, and other text the data is built from. |
| `prisma/seed/reset.ts` | The table list that gets emptied. |
| `prisma/seed/users.ts` | Users, profiles, accounts, sessions, reset codes. |
| `prisma/seed/reference.ts` | Leave types, holidays, blocker reasons, AI templates. |
| `prisma/seed/leave.ts` | Leave requests and balances. |
| `prisma/seed/projects.ts` | Projects, type tags, staffing. |
| `prisma/seed/documents.ts` | Project documents, including revision history. |
| `prisma/seed/time-tracking.ts` | Project and meeting time segments. |
| `prisma/seed/workflow.ts` | Additional requirements, blockers, internal reviews, client feedback. |
| `prisma/seed/work-reports.ts` | Daily plans and wrap ups. |
| `prisma/seed/ai.ts` | AI status reports and jobs. |
| `prisma/seed/logs.ts` | Project activity, audit logs, notifications. |

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ECONNREFUSED ... 6379` on startup | Redis is not running. | Start `redis-server`, or ignore it. Only the two queued AI features need it. The API still works. |
| AI endpoints return an error | `ANTHROPIC_API_KEY` is empty, or Redis is down. | Set the key and start Redis. Everything else in the app runs without either. |
| `GET /projects/:id/ai/summary` returns 400 | `startDate` and `endDate` are required query parameters. | Add both as ISO dates. |
| `Cannot find module '@prisma/client'` | The client was never generated. | Run `npx prisma generate`. |
| `Prisma Migrate has detected that the environment is non-interactive` | You ran `migrate dev` from a script or an agent. | Use `npx prisma migrate deploy`. To add a migration, hand write the folder under `prisma/migrations/` and then deploy it. |
| Sign in returns 403 with `ACCOUNT_SUSPENDED` | That account is suspended on purpose. | Use one of the six accounts in section 5. |
| Sign in returns 401 | Wrong password, or the account was never seeded. | Reseed, then use the password in section 5. |
| Seed stops with a message about production | `NODE_ENV=production` in your `.env`. | Confirm you are pointed at a development database, then unset it, or pass `--force`. |
| Ids changed after a reseed | You edited a row count in `config.ts`. | Expected. Refresh any saved ids in Postman. |
| A table has fewer than 100 rows | A volume was lowered. | The seed report names the table. Raise the matching value in `config.ts`. |

---

## 11. Quick reference

```bash
pnpm install                  # install, and generate the Prisma client
pnpm seed                     # wipe and refill the database
pnpm seed:reset               # drop the schema, migrate, then seed
pnpm start:dev                # dev server on PORT, migrations applied first
pnpm build                    # compile to dist
pnpm lint                     # eslint with fixes
pnpm format                   # prettier
npx tsc --noEmit              # typecheck only
npx prisma migrate deploy     # apply pending migrations
npx prisma studio             # browse the seeded data
```
