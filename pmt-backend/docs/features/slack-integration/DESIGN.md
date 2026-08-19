# Slack Integration Feature Design

**Version**: 1.0 (As-built)
**Status**: Implemented — built on `feature/5-slack-integration`, not yet merged to `main`
**Created**: 2026-07-26
**Updated**: 2026-08-01 — rewritten to describe the actual shipped implementation. §10 (new) covers the two backfill endpoints and other deltas added after this design was originally written.

This started as the first draft, written directly from the requirements given verbatim by the project owner, following the same draft-first pattern as `docs/features/daily-standups/DESIGN.md`. §§1-9 below are now describing what was actually built, not what was planned — see §10 for exactly what changed along the way.

Before this feature, no Slack/notification/queue infrastructure existed anywhere in this backend. Every prior feature that mentioned Slack in its original spec (Daily Work Reports, Real-Time Blockers) had explicitly deferred it — this is where it was finally built.

---

## 1. Feature Overview

Every `Project` gets its own private Slack channel, created automatically the moment the project is created. Membership in that channel is kept in lockstep with `ProjectMember` — being staffed adds you, leaving removes you — and access is **strictly limited to people actually staffed on that specific project**, regardless of role:

- An active `ProjectMember` (Project Manager, Developer, or Designer) on the project **can** access its channel.
- Anyone **not** staffed on that project — including a Developer/Designer staffed on *other* projects, and including a Project Manager who isn't staffed on *this* project — **cannot** access it.

This is a deliberate tightening beyond the API-level authorization model: elsewhere in this backend a Project Manager has company-wide *read* access to any project's data (see `docs/ROLES_AND_PERMISSIONS.md`), but Slack channel membership follows staffing only, with no "PM sees everything" exception. See §7 Q2 for the one open question this raises (ADMIN/SYSTEM_ADMIN visibility).

On top of per-project channels, submitting a daily plan or wrap-up also always posts to **one single, fixed, company-wide channel** — a combined feed of every standup/wrap-up across every project, in addition to (not instead of) the per-project post.

---

## 2. Business Rules (as specified)

1. **Project created → Slack channel created.** The moment a `Project` row is created, a private Slack channel is created for it automatically. No manual step.
2. **Staffed → channel access; removed → channel access revoked.** Adding a `ProjectMember` (any of PM/Developer/Designer) invites that person to the project's Slack channel. Removing a member (`leftAt` set) removes them from the channel. Channel membership is always exactly the current active `ProjectMember` set — nothing more, nothing less.
3. **Not staffed → no access, no exceptions among staff roles.** A Developer/Designer/Project Manager who isn't an active member of that specific project cannot see or access its channel, even though a Project Manager can read that project's data through the API. This is per the project owner's explicit instruction ("other developer can't access, or designer, or PM even").
4. **Daily plan/wrap-up submission posts to the project channel.** When a Developer/Designer submits their plan (`PLAN_SUBMITTED`) or wrap-up (`WRAP_UP_SUBMITTED`) for a project, a message is posted to that project's Slack channel.
5. **Daily plan/wrap-up submission *also* posts to one fixed, global channel.** Independent of the per-project post above, the same submission is posted to a single company-wide channel that aggregates every plan/wrap-up across every project — "one fixed channel where goes all daily standup and wrap[-up] fully."
6. **Blocker events post to the project channel.** Reporting a blocker (`BLOCKER_ADDED`) and changing its status (`BLOCKER_STATUS_CHANGED`, most notably resolving it) post a message to that blocker's project channel.

---

## 3. Non-Goals for v1 (resolved per §7)

- No bidirectional sync — this is outbound-only (the backend posts to Slack; nothing in Slack triggers an action back in the app). No slash commands, no interactive buttons.
- No queue infrastructure (Bull/Redis) — v1 stays inline, fire-and-forget (§7 Q7).
- No archiving/deleting the Slack channel when a project is archived/cancelled/completed — the channel is left exactly as-is regardless of project state (§7 Q5).
- `CLIENT` is never added to a project channel — only staffed PM/Developer/Designer plus (per §7 Q2) every resolvable ADMIN/SYSTEM_ADMIN.
- No retroactive channel backfill — if a new ADMIN/SYSTEM_ADMIN is created (or an existing one's Slack account only becomes resolvable) after a project's channel already exists, they are not automatically invited to already-existing channels. Only channel creation time re-checks the current ADMIN/SYSTEM_ADMIN roster. Flag this if it becomes a real gap.
- No DM alerts (the original Blocker design floated "for HIGH severity, also DM the PM" — not included here, not asked about in §7 either — treat as still deferred).

---

## 4. Architecture

### New module: `src/modules/slack/`

Mirrors the shape of `src/modules/mail/` and `src/modules/uploads/` — a small, generic wrapper other feature services call into, not a Nest-routed feature of its own.

```
src/modules/slack/
  slack.module.ts       — exports SlackService
  slack.service.ts      — thin wrapper over the Slack Web API
```

`SlackService` responsibilities (fire-and-forget from every caller — see §5):

- `createProjectChannel(name: string): Promise<string | null>` — creates a private channel, returns its Slack channel ID, or `null` if creation failed (see §5).
- `inviteToChannel(channelId: string, slackUserId: string): Promise<void>`
- `removeFromChannel(channelId: string, slackUserId: string): Promise<void>`
- `postMessage(channelId: string, text: string): Promise<string | null>` — returns the message's Slack `ts` (needed to later update it in place, per §7 Q6), or `null` if the post failed.
- `updateMessage(channelId: string, ts: string, text: string): Promise<void>` — edits a previously posted message in place via `chat.update`. No-ops (log and skip) if `ts` is missing/unknown.
- `lookupUserIdByEmail(email: string): Promise<string | null>` — wraps `users.lookupByEmail`; returns `null` (and logs at `debug`, not `warn`) on `user_not_found`/`users_not_found` rather than throwing, since not every `User.email` is guaranteed to exist in the Slack workspace.
- `verifyChannelAccessible(channelId: string): Promise<boolean>` — wraps `conversations.info`; confirms the bot can see the channel and it isn't archived. *(Added after the original design — see §10; used by the manual-channel-linking backfill endpoint.)*

Like `CloudinaryService`/`MailService`, this needs `import 'dotenv/config'` at the top if it reads `process.env.SLACK_BOT_TOKEN` at module-load time rather than inside a method — see CLAUDE.md's "dotenv/config load-order trap" note, which has already bitten this codebase twice (Cloudinary, auth.instance.ts).

### Schema additions

```prisma
model Project {
  // ...existing fields...
  slackChannelId String? // set once the channel is created; null until then / if creation failed
}

model User {
  // ...existing fields...
  slackUserId String? // cached from users.lookupByEmail on first successful resolution — see §7 Q3
}

model DailyProjectEntry {
  // ...existing fields...
  planProjectSlackTs   String? // ts of the plan message posted to the project channel
  planFeedSlackTs      String? // ts of the same plan posted to SLACK_DAILY_FEED_CHANNEL_ID
  wrapUpProjectSlackTs String? // ts of the wrap-up message posted to the project channel
  wrapUpFeedSlackTs    String? // ts of the same wrap-up posted to SLACK_DAILY_FEED_CHANNEL_ID
}
```

(`pixelvega-build-spec.md`'s original draft schema already anticipated `Project.slackChannelId` — it's just never been implemented until now. `User.slackUserId` and the four `DailyProjectEntry` ts columns are new, added to resolve §7 Q3 and Q6.)

### Channel naming (§7 Q4)

Slugify every tagged `ProjectType` (sorted alphabetically for determinism, since a project can have more than one — see `ProjectTypeTag`) plus the project name, all lowercase, words hyphenated:

```
types.sort().map(slugify).join('-') + '-' + slugify(project.name)
```

Example: types `['WORDPRESS', 'SEO']`, name `Acme Rebrand` → `seo-wordpress-acme-rebrand`. Truncate to Slack's 80-character channel name limit, then append a numeric suffix (`-2`, `-3`, ...) on collision, same as originally proposed. `CreateProjectDto.projectTypes` requires `ArrayMinSize(1)`, so at least one type is always known at creation time — no timing gap between "channel created" and "types assigned."

### Auto-inviting ADMIN/SYSTEM_ADMIN (§7 Q2)

At channel creation, in addition to auto-staffing the creating PM (existing `ProjectsService.create()` behavior), look up every current `ADMIN`/`SYSTEM_ADMIN` user's `slackUserId` (via the cached-lookup helper below) and invite each one that resolves. This is a one-time roster snapshot at creation time only — not a standing sync (see §3's new non-goal on retroactive backfill).

### Resolving a `User`'s Slack ID (§7 Q3 — resolved as option (b))

A shared private helper (e.g. `resolveSlackUserId(user)` called from `ProjectMembersService`/`ProjectsService`) does:

1. If `user.slackUserId` is already set, use it.
2. Otherwise call `SlackService.lookupUserIdByEmail(user.email)`. Since this workspace's Slack accounts and this app's accounts share the same email address (confirmed by the project owner), the lookup is expected to succeed for any real employee.
3. On success, persist `slackUserId` on the `User` row (same lazily-cached pattern as `avatarUrl`) and use it.
4. On failure (`user_not_found`), log and no-op — the caller (invite/post) simply skips that user, per §5's failure handling.

### Where each business rule hooks in

| Rule | Hook point |
|---|---|
| Channel created on project creation | `ProjectsService.create()`, after the `Project` row + `PROJECT_CREATED` activity. Also invites the auto-staffed PM and every resolvable ADMIN/SYSTEM_ADMIN (see above). |
| Invite on staffing add | `ProjectMembersService.add()`, after the `ProjectMember` row + `MEMBER_JOINED` activity |
| Remove on staffing removal | `ProjectMembersService.remove()`, after `leftAt` is set + `MEMBER_LEFT` activity |
| Post on plan/wrap-up submission | `DailyWorkReportService.create()` (plan) and `.submitWrapUp()` — after `PLAN_SUBMITTED`/`WRAP_UP_SUBMITTED` activity logging, once per project entry. Stores the returned `ts` in the matching `DailyProjectEntry` column. |
| Post to the fixed company-wide channel | Same two hook points as above, additional call to `SLACK_DAILY_FEED_CHANNEL_ID`, `ts` stored in the matching `*FeedSlackTs` column |
| Update in place on plan/wrap-up edit | `DailyWorkReportService`'s plan/wrap-up update paths (within the existing edit windows — see CLAUDE.md's "two independent edit windows" note) — after `PLAN_UPDATED`/`WRAP_UP_UPDATED` activity logging, call `SlackService.updateMessage()` for both the project-channel `ts` and the feed `ts` if present; no-op per message if its `ts` is null (original post failed or Slack was down) |
| Post on blocker report/status change | `BlockerService.addBlocker()` / `.updateBlocker()` — after `BLOCKER_ADDED`/`BLOCKER_STATUS_CHANGED` activity logging |
| Backfill: re-invite an existing member | `POST /projects/:projectId/members/:memberId/resync-slack` → `ProjectMembersService.resyncSlackChannelMembership()` — see §10 |
| Backfill: connect a channel to a project that never got one | `PATCH /projects/:id/slack-channel` → `ProjectsService.connectSlackChannel()` — see §10 |

This mirrors how `ProjectActivityService.log()` is already called from every one of these exact spots — Slack posting is a second side-effect alongside the existing activity-log write, not a replacement for it.

Message text (plan/wrap-up/blocker posts alike) uses a shared bullet-point formatter — one `•` line per non-empty line of the free-text content — under a `*Author — Title (YYYY-MM-DD)*` header. This was refined after the initial implementation; see §10.

---

## 5. Async & Failure Handling

**Every Slack call must be non-blocking and must never fail the underlying API request.** If Slack is down, misconfigured, or rate-limited, project creation / staffing / standup submission / blocker reporting must still succeed for the caller.

- No queue infrastructure (no Bull/Redis) exists in this backend today, and adding one is confirmed out of scope for v1 (§7 Q7). v1 calls the Slack Web API inline but explicitly does not `await` it in the calling service method; the promise is fired and its rejection is caught and logged (`.catch(err => logger.warn(...))`), never re-thrown.
- A failed channel creation leaves `Project.slackChannelId` as `null` — every downstream Slack call (invite/post) must no-op safely (log and skip) when `slackChannelId` is `null`, rather than throwing. A project without a working Slack channel must remain fully usable through the API.
- Same no-op-on-null-channel rule applies if a `User` has no mapped Slack ID yet (e.g. their email doesn't match any Slack workspace member).
- Same rule extends to the new update-in-place path (§7 Q6): if the original `postMessage()` call failed (or Slack was down at the time), the `*SlackTs` column stays `null` and a later edit's `updateMessage()` call is skipped rather than falling back to posting a fresh message — a silent duplicate would be worse than a missed edit.

---

## 6. What Does *Not* Change

- Nothing about the existing PM-of-project / company-wide authorization model (`docs/ROLES_AND_PERMISSIONS.md`) changes. Slack channel membership is a separate, stricter access surface layered on top — a Project Manager still has full API read/write access to a project they aren't staffed on (per that model), they just won't be in its Slack channel.
- No new `ProjectActivityType` values are needed — every trigger point already has an activity type (`PROJECT_CREATED`, `MEMBER_JOINED`, `MEMBER_LEFT`, `PLAN_SUBMITTED`, `WRAP_UP_SUBMITTED`, `BLOCKER_ADDED`, `BLOCKER_STATUS_CHANGED`); Slack posting is an additional side-effect at the same call sites, not a new kind of event.

---

## 7. Open Questions — Resolved

- [x] **Q1 — Slack app credentials.** No Slack app/bot exists yet for this workspace. This is a hard blocker for end-to-end testing (§9) but not for building the code: `SlackModule`/`SlackService` is built as a real wrapper over the Slack Web API immediately, just left untested against a live workspace until the app exists and `SLACK_BOT_TOKEN` is set.
- [x] **Q2 — ADMIN/SYSTEM_ADMIN channel access.** Yes — every `ADMIN`/`SYSTEM_ADMIN` user is auto-invited to a project's channel at the moment it's created, on a best-effort basis (only those whose Slack ID resolves — see Q3). This is a one-time snapshot at creation time, not a standing sync; see §3's new non-goal on retroactive backfill.
- [x] **Q3 — `User` → Slack user ID mapping.** Option (b): cache `slackUserId` on `User`, populated lazily via `users.lookupByEmail` on first use. Confirmed workable because this workspace's Slack accounts and this app's accounts use the same email address, so the lookup is expected to reliably succeed rather than being a fragile assumption.
- [x] **Q4 — Channel naming convention.** Slugified, sorted `ProjectType`s + slugified project name, all lowercase, hyphen-separated words (e.g. `seo-wordpress-acme-rebrand`) — see §4 for the exact algorithm and collision handling.
- [x] **Q5 — Channel lifecycle on project archive/cancel/complete.** Leave it exactly as-is — no archiving, no deletion, regardless of `Project.archivedAt` or terminal `status`.
- [x] **Q6 — Does editing a plan/wrap-up also touch Slack?** Yes, both places it was originally posted: the project channel and the company-wide feed channel are each updated in place (`chat.update`, not a new post) when `PLAN_UPDATED`/`WRAP_UP_UPDATED` fires within the edit window. Requires storing the original message `ts` — see the four new `DailyProjectEntry` columns in §4.
- [x] **Q7 — Inline vs. queued posting.** Inline, fire-and-forget, no queue — the project owner deferred this choice to whichever is best given the constraints. Reasoning: this backend has no Bull/Redis (or any queue) infrastructure today, and introducing one solely for this feature is a disproportionately large addition versus the actual reliability need at current scale. If dropped Slack messages under sustained outages become an operational problem later, a lightweight retry-tracking column is a smaller intermediate step than a full queue — worth flagging then, not building preemptively now.
- [x] **Q8 — Fixed company-wide channel ID.** Confirmed — `SLACK_DAILY_FEED_CHANNEL_ID` env var, same pattern as `SEED_ADMIN_EMAIL`/`CLOUDINARY_*`.

---

## 8. Status

All three steps below are done — `SlackModule`/`SlackService`, the schema migration, and every hook point in §4's table (including the two backfill endpoints added afterward, see §10) are built and merged into this feature branch. See `IMPLEMENTATION_CHECKLIST.md` for the line-by-line account.

1. ~~Answer §7's open questions.~~ Done.
2. ~~Write `IMPLEMENTATION_CHECKLIST.md`.~~ Done.
3. ~~Implement `SlackModule`/`SlackService`, the schema migration, and the hook points in §4's table.~~ Done.

---

## 9. Prerequisite: creating the Slack app (blocks real testing, not coding)

Per §7 Q1, no Slack app exists yet. Code can be written and reviewed without it, but nothing can be tested against a live workspace until:

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) (from scratch), in this workspace.
2. Add these Bot Token Scopes (OAuth & Permissions) — corrected to the private-channel ("groups") scopes, since every channel this integration creates is private (`is_private: true`); `channels:*` scopes are for public channels and don't apply here: `chat:write` (post/update messages), `groups:write` (create private channels via `conversations.create`, and remove members via `conversations.kick`), `groups:write.invites` (add members via `conversations.invite`), `groups:read` (list/verify private channels, useful for the collision check in §4), `users:read` + `users:read.email` (email → Slack user ID lookup for §7 Q3 — Slack's manifest validator rejects `users:read.email` unless its parent scope `users:read` is also listed).
   - If creating the app via manifest (JSON), the manifest also needs a `features.bot_user` block (`{ "display_name": "...", "always_online": false }`) — Slack's validator rejects a manifest with bot scopes but no `bot_user` defined.
3. Install the app to the workspace; copy the **Bot User OAuth Token** (`xoxb-...`).
4. Create (or pick) the one fixed channel for the company-wide daily feed and copy its channel ID.
5. Set both as env vars: `SLACK_BOT_TOKEN` and `SLACK_DAILY_FEED_CHANNEL_ID` (confirmed per §7 Q8) — same `.env` pattern as `CLOUDINARY_*`/`SEED_ADMIN_EMAIL`.

This is a one-time setup step for the project owner; nothing here needs code.

---

## 10. What Was Added After This Design Was Originally Written

The automatic paths in §4's table (channel creation at project-creation time, invite/remove on staffing change) each only ever run **once** and never retry. Two backfill endpoints were added to handle the gaps that creates — neither was in the original design:

- **`POST /projects/:projectId/members/:memberId/resync-slack`** (`ProjectMembersService.resyncSlackChannelMembership()`) — re-resolves and re-invites an existing active member, for when they didn't have a Slack account (or used a different email) at the time they were originally staffed. Returns `{ invited: boolean, message }` rather than an error when no Slack account resolves yet.
- **`PATCH /projects/:id/slack-channel`** (`ProjectsService.connectSlackChannel()`) — backfills a channel for a project that never got one (e.g. channel creation failed at project-creation time). Omit `slackChannelId` in the body to auto-create a new channel using the same naming logic as creation-time; pass one to link a channel someone already made by hand in Slack (verified accessible via `SlackService.verifyChannelAccessible()`, which rejects archived/inaccessible channels with 400). Either way, invites the **current** full active roster + admins, not just whoever was staffed at the time the channel was (or wasn't) created. Returns 409 if the project already has a channel — no silent relink.

Other deltas from the original design:

- **Message formatting was refined after the first pass.** The original design didn't specify exact message text. What shipped: a shared `formatBullets()` helper (one `•` line per non-empty line of free text) and a `*Author — Title (YYYY-MM-DD)*` header, used consistently across plan/wrap-up/blocker posts — see `docs/features/daily-standups/DESIGN.md` §7 for the exact templates.
- **`SlackService.verifyChannelAccessible()`** was added specifically to support the manual-channel-linking path of `connectSlackChannel()` above — not anticipated in the original `SlackService` method list in §4.
- As of this writing, the feature is built and merged into `feature/5-slack-integration` but **not yet merged to `main`**.
