# Slack Integration Implementation Checklist

**Status**: Pending Implementation
**Priority**: Medium (after core project features)
**Version**: 0.1
**Design reference**: `docs/features/slack-integration/DESIGN.md` (v0.2, all §7 open questions resolved)

---

## Pre-Implementation

- [x] Review and answer all of `DESIGN.md` §7's open questions (done — see DESIGN.md v0.2)
- [ ] Create the Slack app and set `SLACK_BOT_TOKEN`/`SLACK_DAILY_FEED_CHANNEL_ID` (DESIGN.md §9) — blocks end-to-end testing, not writing the code
- [x] Add `@slack/web-api` to `package.json` (not currently a dependency anywhere in this repo)

---

## Phase 1: Core Slack Infrastructure (6-8 hours)

### A. Database & Migrations

- [x] Add to `prisma/schema.prisma`:
  - `Project.slackChannelId String?`
  - `User.slackUserId String?`
  - `DailyProjectEntry.planProjectSlackTs String?`
  - `DailyProjectEntry.planFeedSlackTs String?`
  - `DailyProjectEntry.wrapUpProjectSlackTs String?`
  - `DailyProjectEntry.wrapUpFeedSlackTs String?`
- [x] Hand-write the migration folder (`prisma/migrations/20260728100000_add_slack_integration/migration.sql`) per CLAUDE.md's Prisma note — `migrate dev` will refuse in this non-interactive shell
- [x] Apply with `npx prisma migrate deploy`, then `npx prisma generate`

### B. `SlackModule` / `SlackService`

```
Location: src/modules/slack/
  slack.module.ts
  slack.service.ts
```

- [x] `import 'dotenv/config'` at the top of `slack.service.ts` if `SLACK_BOT_TOKEN` is read at module-load time (constructing the `WebClient`) rather than inside a method — same load-order trap as `cloudinary.service.ts`/`auth.instance.ts` (CLAUDE.md). **Decision**: not needed — `WebClient` is built as a class field initializer (same pattern as `MailService`'s `transporter`), which runs at Nest DI instantiation time, not at module `require` time, so it isn't affected by the trap the same way `cloudinary.service.ts`'s top-level `cloudinary.config()` call is.
- [x] Skeleton: `SlackService` class with `@Injectable()`, a `Logger`, and a `WebClient` built from `process.env.SLACK_BOT_TOKEN`
- [x] `createProjectChannel(name: string): Promise<string | null>`
  - `conversations.create({ name, is_private: true })`
  - Catch and log any error (invalid name, name taken, API down) → return `null`, never throw
- [x] `inviteToChannel(channelId: string, slackUserId: string): Promise<void>`
  - `conversations.invite({ channel: channelId, users: slackUserId })`
  - Catch and log (e.g. `already_in_channel` is not an error worth logging loudly) → never throw
- [x] `removeFromChannel(channelId: string, slackUserId: string): Promise<void>`
  - `conversations.kick({ channel: channelId, user: slackUserId })`
  - Catch and log → never throw
- [x] `postMessage(channelId: string, text: string): Promise<string | null>`
  - `chat.postMessage({ channel: channelId, text })`
  - Return `result.ts` on success, `null` (logged) on failure
- [x] `updateMessage(channelId: string, ts: string, text: string): Promise<void>`
  - `chat.update({ channel: channelId, ts, text })`
  - Catch and log → never throw
- [x] `lookupUserIdByEmail(email: string): Promise<string | null>`
  - `users.lookupByEmail({ email })`
  - Return `result.user.id` on success; on `user_not_found` (or any error) log at `debug`/`warn` (expected to happen for non-Slack-workspace emails) and return `null`
- [x] `SlackModule` — providers: `SlackService`, `SlackUserResolverService` (see §C below); exports both; added to `AppModule` imports. `ProjectsModule` will need to import `SlackModule` itself in Phase 2 to inject these (not global, unlike `PrismaModule`/`AuditLogModule`).

### C. Shared Slack-ID resolution helper

- [x] Add a private helper (e.g. `resolveSlackUserId(user: User): Promise<string | null>`) — per DESIGN.md §4's "Resolving a User's Slack ID":
  1. Return `user.slackUserId` if already set
  2. Else call `SlackService.lookupUserIdByEmail(user.email)`
  3. On success, `prisma.user.update({ where: { id: user.id }, data: { slackUserId } })` and return it
  4. On failure, return `null`
  - **Decision**: implemented as its own injectable, `SlackUserResolverService` (`src/modules/slack/slack-user-resolver.service.ts`), exported alongside `SlackService` from `SlackModule`. Kept out of `SlackService` itself since that class is otherwise a stateless 1:1 Slack API wrapper with no Prisma dependency — folding a Prisma read/write into it would break that symmetry. `ProjectsService`/`ProjectMembersService` will inject `SlackUserResolverService` directly in Phase 2 rather than duplicating the 4-step logic.

### D. Channel naming helper

- [x] Add a `slugify(input: string): string` utility (lowercase, non-alphanumeric → `-`, collapse/trim repeated hyphens) — check `src/common/utils/` first in case something reusable already exists before adding a new one. Nothing reusable existed; added to `src/modules/slack/slack-channel-naming.util.ts` (scoped to this module rather than `src/common/utils/`, since it's Slack-channel-specific, not general-purpose).
- [x] Add `buildChannelName(projectTypes: ProjectType[], projectName: string): string` — sorts + slugifies types, joins with the slugified name, per DESIGN.md §4's algorithm (e.g. `seo-wordpress-acme-rebrand`)
- [x] Truncate to Slack's 80-character channel name limit
- [x] Collision handling: if `conversations.create` fails with `name_taken`, retry with a numeric suffix (`-2`, `-3`, ...) up to a small max attempt count, then give up and log (channel stays `null`, same as any other creation failure). **Decision**: implemented inside `SlackService.createProjectChannel()` itself (retry loop with `MAX_NAME_COLLISION_ATTEMPTS = 5`), not in the naming util — the naming util only builds the desired base name string; the retry/collision loop needs to call the Slack API per attempt, so it belongs with the other API-calling logic in `SlackService`.

---

## Phase 2: Wiring Into Existing Services (8-10 hours)

All calls in this phase are fire-and-forget from the caller's perspective — fired without `await`ing to completion in a way that could delay the response, rejection caught and logged, never re-thrown (DESIGN.md §5). **Decision**: literally un-awaited (`.catch(...)`, no `await` on the outer call), used consistently at every hook point below — each public method fires a private `async` helper without awaiting it, chaining `.catch((error) => this.logger.warn(...))`. Where a `ts`/id needs to be persisted after the Slack call resolves, that write happens inside the same un-awaited helper (e.g. `postEntryPlanToSlack()`), not back in the public method — this guarantees zero added latency to the underlying request in every case, matching §5's "must never fail the underlying API request" requirement most strongly.

### A. `ProjectsService.create()` (`src/modules/projects/projects.service.ts`)

- [x] After the existing `PROJECT_CREATED` activity log and PM auto-staffing:
  - Build the channel name (Phase 1D) and call `SlackService.createProjectChannel()`
  - `prisma.project.update({ where: { id: project.id }, data: { slackChannelId } })` if non-null
  - Invite the auto-staffed PM (resolve their Slack ID via Phase 1C helper)
  - Look up all current `ADMIN`/`SYSTEM_ADMIN` users (`prisma.user.findMany({ where: { role: { in: [ADMIN, SYSTEM_ADMIN] }, deletedAt: null } })`) and invite each one that resolves (DESIGN.md §7 Q2 — one-time snapshot, not a standing sync)
  - Implemented as private `syncSlackChannelForNewProject()`, fired un-awaited from `create()`.

### B. `ProjectMembersService.add()` / `.remove()` (`src/modules/projects/project-members.service.ts`)

- [x] `add()`: after the `MEMBER_JOINED` activity log, resolve the new member's Slack ID (Phase 1C) and call `SlackService.inviteToChannel()` if the project has a `slackChannelId` and the user resolves — no-op (log and skip) otherwise
- [x] `remove()`: after the `MEMBER_LEFT` activity log, same lookup + call `SlackService.removeFromChannel()`. `MEMBER_INCLUDE`'s selected `user` shape deliberately wasn't widened to include `slackUserId` (avoids leaking that internal id into the public members-list API response) — `remove()` does a separate minimal-select `prisma.user.findUnique()` by id instead.

### C. `DailyWorkReportService` (`src/modules/projects/daily-work-report.service.ts`)

- [x] `create()` (initial plan submission, `PLAN_SUBMITTED`): for each `DailyProjectEntry`, after activity logging, post to the project's channel and to `SLACK_DAILY_FEED_CHANNEL_ID`; store the two returned `ts` values in `planProjectSlackTs`/`planFeedSlackTs` on that entry
- [x] `submitWrapUp()` (`WRAP_UP_SUBMITTED`): same pattern, storing into `wrapUpProjectSlackTs`/`wrapUpFeedSlackTs`
- [x] `updatePlan()` (`PLAN_UPDATED`): after activity logging, call `SlackService.updateMessage()` against `planProjectSlackTs`/`planFeedSlackTs` if each is non-null; skip (no fresh post) if null
- [x] `updateWrapUp()` (`WRAP_UP_UPDATED`): same pattern against `wrapUpProjectSlackTs`/`wrapUpFeedSlackTs`
- [x] Decide and document the actual Slack message text format — refined after the first pass into a shared format used by every post type in this module: a `*${authorName} — ${title} (${YYYY-MM-DD})*` header followed by a blank line, then the content run through a shared `formatBullets()` helper (one `•` line per non-empty line of free text). The per-project channel message and the combined feed message use the same header+bullets shape; the feed message additionally prefixes each project's section with `<#channelId>` (or the plain project name if it has no channel).
  - `REPORT_INCLUDE`'s `project` select was widened to include `slackChannelId` (small additive field on report API responses, not sensitive) so the post/update helpers never need a redundant project lookup.

### D. `BlockerService` (`src/modules/projects/blocker.service.ts`)

- [x] `addBlocker()`: after the `BLOCKER_ADDED` activity log, post to the project's channel (no feed-channel post — DESIGN.md's business rules only route blockers to the project channel, not the global feed)
- [x] `updateBlocker()`: after the `BLOCKER_STATUS_CHANGED` activity log, post to the project's channel (no ts stored/updated for blockers — DESIGN.md §7 Q6 only covers plan/wrap-up edits, not blocker status changes, since each status change is logically a new event, not an edit of the previous one). `BLOCKER_INCLUDE`'s `project` select widened to include `slackChannelId` for the same reason as `REPORT_INCLUDE` above.

---

## Phase 2.5: Backfill Endpoints (not in the original design — added afterward)

The automatic paths in Phase 2 (A/B) each only run once and never retry, which left a real gap: a member who didn't have a Slack account yet at staffing time, or a project whose channel creation failed. Two endpoints close that gap:

- [x] **`POST /projects/:projectId/members/:memberId/resync-slack`** (`ProjectMembersService.resyncSlackChannelMembership()`) — re-resolves the member's Slack ID and re-invites them to the project channel. Returns `{ invited: boolean, message }` (not an error) when no Slack account resolves yet.
- [x] **`PATCH /projects/:id/slack-channel`** (`ProjectsService.connectSlackChannel()`) — `ConnectSlackChannelDto` with an optional `slackChannelId`. Omitted: auto-creates a channel using the same naming/collision logic as project-creation time. Provided: links an existing channel after verifying it with `SlackService.verifyChannelAccessible()` (400 if archived/inaccessible). Either way, invites the current full active roster + admins. 409 if the project already has a channel.
- [x] `SlackService.verifyChannelAccessible()` (`conversations.info`) added specifically to support the manual-link path above.

---

## Phase 3: Failure Handling & Edge Cases (3-4 hours)

- [ ] Confirm every `SlackService` method really does swallow its own errors (Phase 1B) — a unit/manual test that stops the Slack bot token temporarily (or points `SLACK_BOT_TOKEN` at garbage) and verifies project creation / staffing / plan submission / blocker reporting all still succeed
- [ ] Confirm a project with `slackChannelId: null` never throws downstream — every call site in Phase 2 must check for `null` before calling into `SlackService`
- [ ] Confirm a user with no resolvable `slackUserId` never blocks an invite/remove/post — same no-op rule
- [ ] Confirm `updateMessage()` calls are skipped (not replaced by a fresh `postMessage()`) when the stored `ts` is `null`

---

## Code Style & Patterns

- [ ] Follow `src/modules/mail/mail.service.ts`'s shape for `SlackService` — a thin wrapper class, no abstraction beyond what's needed
- [ ] Reuse `ProjectActivityService` call sites as the anchor point for every Slack call — don't introduce a second logging mechanism
- [ ] Inject `PrismaService` directly where needed (e.g. persisting `slackChannelId`/`slackUserId`) rather than routing through another service
- [ ] Keep the "fire-and-forget, catch-and-log, never re-throw" rule uniform across every call site (see Phase 2's opening note)

---

## Deployment & Rollout

- [ ] Build and review Phase 1 (`SlackModule`/`SlackService` + migration) — can be merged and deployed even before `SLACK_BOT_TOKEN` exists, since every method safely no-ops without one
- [ ] Build and review Phase 2 (wiring into `ProjectsService`/`ProjectMembersService`/`DailyWorkReportService`/`BlockerService`)
- [ ] Complete DESIGN.md §9 (create the Slack app, set env vars) before attempting real end-to-end verification
- [ ] Manually verify against a real (test) Slack workspace: project creation creates a channel and invites the PM + admins; adding/removing a member invites/removes them; a plan/wrap-up submission posts to both channels; editing a plan/wrap-up updates both messages in place; a blocker report/status change posts to the project channel
- [ ] Merge to `main` once verified

---

## Estimated Effort

| Phase | Component | Estimate |
|-------|-----------|----------|
| 1 | Migration + `SlackService` + naming/lookup helpers | 6-8 hours |
| 2 | Wiring into the four existing services | 8-10 hours |
| 3 | Failure-handling verification | 3-4 hours |
| **Total** | | **17-22 hours (2-3 days for one engineer)** |

---

## Success Criteria

- [ ] Creating a project creates a private Slack channel named per DESIGN.md §4 and invites the auto-staffed PM plus every resolvable ADMIN/SYSTEM_ADMIN
- [ ] Adding a `ProjectMember` invites them to the project channel; removing one removes them
- [ ] A Developer/Designer not staffed on a project — and a PM not staffed on it either — has no access to its channel
- [ ] Submitting a plan or wrap-up posts to both the project channel and the fixed company-wide feed channel
- [ ] Editing a plan or wrap-up within its edit window updates both previously-posted messages in place, not a fresh post
- [ ] Reporting or updating a blocker posts to the project channel
- [ ] Every Slack failure mode (no token, no channel, no resolvable user, API error) leaves the underlying API request fully successful — nothing in this feature can ever fail an unrelated request
- [ ] No queue/Bull/Redis introduced — v1 stays inline per DESIGN.md §7 Q7

---

## Next Steps

1. **Dependency & app setup**: add `@slack/web-api`, complete DESIGN.md §9's Slack app creation
2. **Phase 1**: migration + `SlackService`
3. **Phase 2**: wire into `ProjectsService` / `ProjectMembersService` / `DailyWorkReportService` / `BlockerService`
4. **Phase 3**: failure-handling verification, then manual end-to-end test against a real workspace
