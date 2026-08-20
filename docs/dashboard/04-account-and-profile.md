# Account & User Management

The `/account` screen: what it serves, what it deliberately does not, and the decisions behind both.
Part of the v1 dashboard build. Index: [`../README.md`](../README.md).

---

## What it is

One page for everything a person can change about their own account. It replaces `/profile`, which
had grown from a name field into three unrelated sections behind a left rail.

| Tab          | Contains                                                                           |
| ------------ | ---------------------------------------------------------------------------------- |
| **General**  | Personal Information, Email & Password, Connect Accounts, Social URLs, Danger Zone |
| **Security** | Active sessions: which devices are signed in, revoke one, sign out everywhere else |

`/profile` is a permanent redirect (308) to `/account`. It was the only authenticated destination in
the header dropdown for months, so it is in people's history.

## The tabs that are not there

The design this was built from shows seven: General, Notifications, Workspace, Integrations, Members,
Security, Billing & Usage. Four are absent and one is elsewhere, each for a reason:

| Tab                 | Why it is absent                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Workspace**       | There is no workspace entity. This product has one organization                                                                                  |
| **Integrations**    | No OAuth providers are configured. What genuinely exists (the credential, the Slack member id) is the Connect Accounts block on General          |
| **Billing & Usage** | Internal tool. Nothing is billed                                                                                                                 |
| **Notifications**   | No notification-preference model exists. Adding one is a schema change, not a screen                                                             |
| **Members**         | Team management is `/users`, reached from the sidebar. `navigations.ts` forbids a second door to one screen, and a Members tab here would be one |

A tab that opens an empty screen is a worse answer than a tab that is not there.

## The decisions worth knowing

### `User.name` is stored, not derived

The screen edits `firstName` and `lastName`. Roughly thirty queries select `name`, and none of them
should have to know it is computed, so both representations are stored and kept in step by
`common/utils/name.util.ts`:

- write either half -> `name` is recomposed
- write `name` (an admin, through `PATCH /users/:userId`) -> the halves are re-split

Miss either direction and the account form opens showing a name the rest of the app disagrees with.
`PATCH /profiles/me` therefore does **not** accept `name`: a caller that could send all three could
store a full name contradicting its own parts.

The migration backfills both halves by splitting on the FIRST space. No split is right for every
name, which is why both halves stay editable.

### The password policy is served, and it is enforced

`GET /profiles/options` returns `{ minLength, maxLength, rules: [{ key, label, pattern }] }`. The
checklist on the screen compiles those patterns and renders those labels. It states no rule of its
own.

That only works because the same table is enforced. `assertPasswordMeetsPolicy` in
`auth/instance/password-policy.hook.ts` runs in better-auth's `hooks.before` on all three paths that
set a password: `/sign-up/email`, `/reset-password`, `/change-password`. A rule enforced on two of the
three is not enforced.

The minimum moved from 8 to 12 with four character-class rules. Consequences, all deliberate:

- `generateUnusedPassword()` now seeds one character of each class, so an invite can never mint a
  password its own `/sign-up/email` call would refuse.
- `minPasswordLength` in the better-auth config reads the same constant, so a password cannot fail
  one check and pass the other.
- The emailed reset and first-password screens are stricter too. They surface the backend's message.

### Every list comes from the server

Countries (249, ISO 3166-1 alpha-2, sorted by label), genders, roles, the avatar size cap and the
social-link maximum are all on `GET /profiles/options`. A country list in a browser is a political
question two clients would answer differently; a size cap in copy drifts from the multer limit that
enforces it the first time either moves.

`options` is cached with `staleTime: Infinity`. It cannot change without a deploy.

### Capability flags, and the predicate behind each one

| Flag               | True when                          | Enforced by                                                             |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------------- |
| `canEditProfile`   | Always. Every role edits its own   | `EDIT_OWN_PROFILE`, held by everyone                                    |
| `canChangeEmail`   | Never                              | The DTO does not accept `email`                                         |
| `canChangeRole`    | Never                              | `UsersService.update` refuses a self role change                        |
| `canDeleteAccount` | The caller is not the SYSTEM_ADMIN | `mayDeleteOwnAccount`, called by BOTH the mapper and `deleteOwnAccount` |

The last row is the pattern the rest should copy: the flag and the assertion call the same exported
function. Five flags in this codebase have shipped wider than their enforcement, each offering a
button that then answered 403.

`canChangeEmail` and `canChangeRole` are fields rather than literals in the client because a flag
nobody computed is the same defect as a wrong one.

### Deleting your own account

A soft delete (`deletedAt`), matching `UsersService.remove`. Every time entry, work report and audit
row references the user, so a hard delete would either cascade through the delivery record or fail on
a foreign key.

- Sessions are destroyed in the SAME transaction, so there is no window where the row is gone and a
  live cookie is still accepted.
- The body carries the account's own email. That is a pause on an action with no undo, not a security
  control: the session already proves who is asking.
- The SYSTEM_ADMIN is refused. There must always be a root account, and nothing in the API creates a
  second.
- There is no restore endpoint. An administrator re-invites.

### Connected accounts

Assembled from two unrelated places so a client does not have to know they differ: the `Account` rows
better-auth owns, plus the Slack member id cached on `User`. The credential row carries
`canDisconnect: false` and the route refuses it as well. It is the only way into the account.

The `select` on `Account` is three columns. That table also holds `accessToken`, `refreshToken`,
`idToken` and `password`.

### Sessions

`GET /profiles/me/sessions` excludes expired rows: better-auth does not delete a session when it
expires, so the table holds months of dead ones and a list including them is one nobody can read a
real intrusion off.

- The user agent is parsed on the server into "Chrome on macOS". Two clients would disagree otherwise,
  and the match order matters (Edge announces itself as Chrome and Safari).
- The token never reaches a response. It is a bearer credential.
- `revoke` scopes to the caller **in the query itself**, so another user's session id answers 404
  rather than revealing that it exists.
- The current session cannot be revoked from a row. Signing yourself out is the header's sign-out.

## API surface added

| Route                                       | Permission            |
| ------------------------------------------- | --------------------- |
| `GET /profiles/options`                     | `VIEW_OWN_PROFILE`    |
| `DELETE /profiles/me/avatar`                | `EDIT_OWN_PROFILE`    |
| `DELETE /profiles/me/connections/:provider` | `EDIT_OWN_PROFILE`    |
| `DELETE /profiles/me`                       | `DELETE_OWN_ACCOUNT`  |
| `GET /profiles/me/sessions`                 | `VIEW_OWN_SESSIONS`   |
| `DELETE /profiles/me/sessions/:sessionId`   | `MANAGE_OWN_SESSIONS` |
| `DELETE /profiles/me/sessions/others`       | `MANAGE_OWN_SESSIONS` |

Three new `Permission` members, all in the `EVERYONE` set: these routes only ever touch the caller's
own records, so there is nobody to scope them against.

## Schema

`User` gains `firstName`, `lastName`, `country` (ISO alpha-2 string, not an enum), `gender` (a new
`Gender` enum) and `socialUrls` (`String[]`). Migration `20260820180000_add_account_profile_fields`.

`socialUrls` is a scalar list rather than a table because there is nothing else to say about one
link: no label, no verification, no per-row permission. A join table would buy ordering, and
`String[]` already has it.

## Known gap, not introduced here

`pmt-frontend/e2e/tests/` still holds twelve Playwright specs from the reference dashboard, targeting
`/attributes`, `/hubs`, `/collections` and other routes this product does not have. They are stale
and none of them exercises this screen. Frontend E2E for `/account` waits on that prune.
