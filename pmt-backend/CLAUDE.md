# pmt-backend: the rules

**This file loads automatically whenever anything in `pmt-backend/` is touched.** It is committed, so
it travels with every branch, every PR, and every fresh clone. It is the contract, not a suggestion.

If code you find disagrees with a rule here, the rule is right and the code is a defect. Say so
plainly rather than copying the pattern you found.

The five directives (`../docs/architecture/02-directives.md`) sit above everything below.

---

## 1. Where a file goes

**The route path IS the folder path.** `src/<a>/<b>/` serves `/<a>/<b>`, always, so someone reading
the tree sees the API without opening a controller. `../docs/decisions/0004-the-route-path-is-the-folder-path.md`
is the decision; these are its four corollaries, and each one is a consequence rather than a separate rule.

```
src/projects/documents/              ->  /projects/:projectId/documents
src/projects/reviews/internal/       ->  /projects/:projectId/reviews/internal
src/projects/requirements/additional/ -> /projects/:projectId/requirements/additional
src/leave/requests/                  ->  /leave/requests
src/reports/developers/              ->  /reports/developers
```

One exception, and it is corollary 2 rather than a hole in the rule: a project scoped resource that
also has a cross project view keeps ONE folder under `projects/`, and that folder serves both forms.
`src/projects/blockers/` holds `project-blockers.controller.ts` (`/projects/:projectId/blockers`) and
`blockers.controller.ts` (`/blockers`), and its `reasons/` child serves `/blockers/reasons`, because a
reason is not owned by a project.

1. **A resource's folder names it.** No route segment exists that is not a folder, and no folder
   serves a route it is not named for. Adding a sub-resource decides its URL.
2. **Nested is project scoped and owns every mutation; top level is cross project and read only.**
   `POST` and `PATCH /projects/:projectId/blockers` create and change; `GET /blockers` answers across
   projects and takes `projectId` as a query filter, never as a path segment. A resource that does not
   require a project (a daily work report belongs to a person, a meeting time entry may have no
   project) is top level and mutates there.
3. **Every path parameter is named for the entity it identifies**: `:projectId`, `:blockerId`,
   `:leaveRequestId`. Never `:id`. A parameter's name is not part of the URL, so this breaks no client,
   and it stops Swagger describing one entity under three names.
4. **One entity type per slot.** A segment holding a LeaveRequest id never holds a User id. Where a
   second entity is genuinely the subject it gets its own resource: `/leave/requests/:leaveRequestId`
   and `/leave/balances/:userId` are two resources, not one path with two meanings.

A module is:

```
src/<module>/
├── dto/<module>.dto.ts     ONE file. Response, then Query, then Request, in that order
├── spec/                   EVERY *.spec.ts for this module. Never beside the file it tests
├── <module>.controller.ts  routing only: decorate, delegate, return
├── <module>.service.ts     all business logic
├── <module>.mapper.ts      row -> response DTO. Pure: takes a row and a context, never a database
├── <module>.swagger.ts     one applyDecorators() per endpoint
└── <module>.module.ts
```

- Subdirectories are fine, and expected once a module outgrows a scannable file list. Group by
  feature (`jobs/`, `templates/`), never a dumping ground.
- **`@/` alias for every internal import.** A new `../../` chain is a defect.
- Static routes before dynamic ones: `@Get('me')` above `@Get(':userId')`, or Nest matches `me` as an id.

## 2. The backend serves everything (D4)

The frontend renders what it is given. If two clients would compute it identically, it belongs here.

- **Every enum in a response is `{ value, label, tone }`**, built with `toEnumDisplay()` from
  `common/utils/enum-display.util.ts`. Never a bare enum. `value` is the only field a client may
  branch on; `tone` is a closed set of five.
  Adding a Prisma enum member fails the build until it has a label and tone. That is deliberate.
- **Every resource carries `capabilities`**: one flag per action a screen actually gates, built from
  the caller's permissions AND the project scope rule. Advisory; the service still enforces.
- **A flag and its enforcement must read the SAME predicate.** Never re-derive the rule in a mapper.
  Put the predicate in `ProjectScopeService` (or beside the service's assertion), have the assertion
  call it, and pass its boolean into the mapper through the context. This is the most repeated defect
  in this codebase: five flags shipped wider than their enforcement, each offering a button that then
  answered 403, and every one of them was a mapper re-deriving a rule it did not fully know.
  `mayChangeProjectStatus` / `assertMayChangeProjectStatus` is the shape to copy.
  A hardcoded `true` in a context object is the same bug with no rule at all: `canReviewLeave: true`
  showed a PROJECT_MANAGER an Approve button on every leave request, and the comment above it had
  already noted the exception.
- **Derived values are response fields.** `remainingHours`, `isOverdue`, `daysUntilDeadline`,
  `ageMinutes`, `durationLabel`, `fileSizeLabel`, `entryCount`. No `.sort()`, `.reduce()` or
  `.filter()` in a browser.
- **Sorting and filtering are query params**, applied BEFORE pagination, from an allowlist.
- **A rate is `null`, never `0`, when its denominator is zero.** Zero claims a measured result of
  nothing; null says the question does not apply.
- Exact values always ship alongside formatted ones (`totalMinutes` next to `totalHours`). Nothing
  formatted may feed a calculation.

## 3. Validation is the DTO (D5)

- Length bounds on every free text field, from `common/constants/field-lengths.ts`. Never an inline number.
- **`@ToBoolean()` for boolean query params. NEVER `@Type(() => Boolean)`** — `Boolean('false')` is
  `true`, and every one of these was broken by it.
- `@Type(() => Number)` on numeric query params.
- `@IsEnum(TheEnum)` for a full enum. `@IsIn(SUBSET)` only when the subset is deliberate, with a
  comment saying why (see `ASSIGNABLE_ROLES`, which is the only thing stopping an ADMIN granting root).
- Conditional requiredness: `@ValidateIf(trigger || field !== undefined)` + `@IsNotEmpty()`. The
  second half of that predicate keeps type and length checks running when the field is supplied anyway.
  A custom `RequiredWhen` does not work: `@IsOptional` short circuits every other validator.
- Cross field rules that genuinely need a sibling go in `common/validators/`, each with a spec.
- `@Trim()` where emptiness carries meaning: `@IsNotEmpty()` accepts `"   "`.

## 4. Auth is better-auth's. Do not hand roll any of it

Sign-in, sign-out, forgot password, reset password and change password are served by better-auth at
`/api/auth/*`. `AuthController` is ONE catch-all (`@All('*splat')` handing off to
`toNodeHandler(auth)`) and there must never be a second auth route, in this module or any other.
`PATCH /users/me/password` existed once, to clear `mustResetPassword` and write an audit entry;
that left two doors onto one action with different security properties. An after hook in
`auth.instance.ts` does both now.

No third party Nest adapter. better-auth's docs point at `@thallesp/nestjs-better-auth`, and it was
used here; it mounts the routes with `httpAdapter.use()` in `onModuleInit()`, which put them ahead of
Nest's router. They were invisible to Swagger and outside the guard pipeline. Do not reintroduce it.

Non negotiable, each one closed a real hole:

- **`input: false` on every `user.additionalFields`.** It defaults to `true`, so a caller could
  choose their own `role` in a sign-up body and mint themselves a SYSTEM_ADMIN.
- **`refuseAnonymousSignUp` in `hooks.before`, NOT `disableSignUp: true`.** That flag has no
  exemption for server side `auth.api.signUpEmail()`, so it breaks the invite flow and first boot
  bootstrap. The hook refuses only calls carrying a `request`.
- **better-auth's own `rateLimit.customRules`.** `AuthController` carries `@SkipThrottle()`, so
  Nest's tiers deliberately do not apply: they are sized for a dashboard page load and would lock a
  real user out of sign-in. These per path rules are the brute force defence.
  The reset path is **`/request-password-reset`**, not `/forget-password`, which 404s in 1.6.
- **`sendResetPassword` reads `token`, never `new URL(url).searchParams`.** better-auth puts the
  token in the URL's PATH. Parsing it as a query param shipped every reset email with `?token=`.
- **`onPasswordReset` and the `/change-password` after hook both clear `mustResetPassword`.** Two
  ways a password changes; missing either nags a user forever.
- **An after hook runs on FAILURE too.** The dispatcher catches the endpoint's error and then calls
  them, and the session is already resolved. Check the returned value before acting.
- **`databaseHooks` refuse SYSTEM_ADMIN at the write**, as defence in depth.
- Origin checking is off only when `AUTH_DISABLE_ORIGIN_CHECK === 'true'`. Never inferred from `NODE_ENV`.
- `bodyParser: false` in `main.ts` stays, and `bodyParsersExceptAuth(AUTH_BASE_PATH)` puts a parser
  back for every other route. better-auth reads the raw stream.
- `basePath` is `AUTH_BASE_PATH`, the literal `/api/auth`, and the controller must resolve to it.
- `auth.instance.ts` runs before DI: it needs `import 'dotenv/config'`, the mail **singleton**, and
  `authPrismaClient` rather than `PrismaService`. Its hooks are inline for the same reason.
- **An invite emails a LINK, never a password.** `UsersService.invite` and the bootstrap create the
  account with `generateUnusedPassword()`, which nobody is told, then call
  `auth.api.requestPasswordReset({ body: { email } })` with NO headers. `sendResetPassword` reads
  the missing `request` as "server initiated, so this is an invite" and sends the invite copy with a
  `/set-password` link. A temporary password in an email is a working credential sitting in an inbox
  in plain text with no expiry.
- The `openAPI()` plugin is what documents the auth surface. `mergeBetterAuthSchema` merges the
  GENERATED schema into `/api/docs` and hides the routes this config does not enable. Never
  hand write auth paths: the list that did drifted to three of thirty.

Guard order. **All three live in `AuthModule`'s providers, in this order:**

```
TrustedOriginThrottlerGuard   throttle before spending a DB round trip on a session
AuthGuard                     sets request.user
PermissionsGuard              reads request.user
```

Nest applies the ROOT module's global enhancers BEFORE those of the modules it imports, so a guard
registered in `AppModule` runs FIRST. `PermissionsGuard` was registered there and answered 401 to
every authenticated request. `auth/spec/guard-order.spec.ts` pins the order.

## 5. Authorization

- Gate with `@RequirePermissions(Permission.X)`. Never `@Roles()`.
- **Scope is `ProjectScopeService`**, never a private copy. It was implemented twelve times before.
- A permission answers "may this role ever". Scope answers "may they, to THIS project".
- **A public method that maps its result must not be reused as an internal lookup.** Mapping
  `UsersService.findOne` turned `existing.role === Role.SYSTEM_ADMIN` into object-versus-string,
  silently false, and two protections stopped firing. Keep a private `get<X>OrThrow` returning the raw row.
- `select:` on every `user.find*`. `User.password` holds a real hash.

## 6. Uploads

`CloudinaryService` handles any file type. Do not add a second uploader.

- `upload(file, { folder })` — `resource_type: 'auto'`. Never guess from the mimetype.
- `uploadMany` — concurrent, all or nothing, rolls back what landed.
- **Store `publicId` AND `resourceType`.** A URL cannot destroy an asset, and Cloudinary partitions
  its namespace by resource type: destroying a raw file as an `'image'` succeeds and deletes nothing.
- Multer rules come from `uploadOptions({ maxSizeMb, allow })`. Never a new options file.

## 7. Mail

Every email is built with `emailShell()`.

- **Escape everything user supplied.** The invite template interpolated a name raw.
- Always send the `text` part too.
- Tables and inline styles: Outlook renders with Word, Gmail strips `<style>` on forwards.
- An expiry stated in copy is a parameter, never a literal, or it drifts from the config.

## 8. Prisma

- Always `select:` or a shared `include` const. Never a raw row to a client.
- `$transaction` for multi step writes. `paginate()` from `common/utils/pagination.util`.
- Schema is split by domain. **`prisma migrate dev` needs a TTY**: hand write the folder and
  `migration.sql`, then `migrate deploy`.

## 9. Tests

- Every branch, every guard, every thrown exception.
- Assert the value a mock was called WITH, not merely that it was called.
- A test that still passes when the implementation is deleted is not a test.
- Specs live in `spec/`.

## 10. Prose and commits

- **No hyphen or em dash as a clause connector** in any prose you write: markdown, comments, Swagger
  `description`, error messages. Use a colon, parentheses, or two sentences. Compound words are fine.
- Comments say **why**, never what. A comment restating the line below it is noise.
- **No attribution trailer in a commit message.** No `Co-Authored-By`, no "Generated with".
- Tick `../docs/refactor/02-checklist.md` as each item completes, from evidence.

## 11. Ports and the gate

Backend **5050**, frontend **3000**.

```
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build
```

All five, green, before you say you are done.
