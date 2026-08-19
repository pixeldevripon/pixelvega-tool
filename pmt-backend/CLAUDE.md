# pmt-backend: the rules

**This file loads automatically whenever anything in `pmt-backend/` is touched.** It is committed, so
it travels with every branch, every PR, and every fresh clone. It is the contract, not a suggestion.

If code you find disagrees with a rule here, the rule is right and the code is a defect. Say so
plainly rather than copying the pattern you found.

The five directives (`../docs/architecture/02-directives.md`) sit above everything below.

---

## 1. Where a file goes

**The folder path mirrors the route path.** Someone reading the tree sees the API without opening a
controller.

```
projects/:projectId/documents             ->  src/projects/documents/
projects/:projectId/internal-reviews      ->  src/projects/reviews/internal/
projects/:projectId/additional-requirements -> src/projects/requirements/additional/
```

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
- Static routes before dynamic ones: `@Get('mine')` above `@Get(':id')`, or Nest matches `mine` as an id.

## 2. The backend serves everything (D4)

The frontend renders what it is given. If two clients would compute it identically, it belongs here.

- **Every enum in a response is `{ value, label, tone }`**, built with `toEnumDisplay()` from
  `common/utils/enum-display.util.ts`. Never a bare enum. `value` is the only field a client may
  branch on; `tone` is a closed set of five.
  Adding a Prisma enum member fails the build until it has a label and tone. That is deliberate.
- **Every resource carries `capabilities`**: one flag per action a screen actually gates, built from
  the caller's permissions AND the project scope rule. Advisory; the service still enforces.
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
`/api/auth/*`. There is no auth controller in this app and there must not be one.

Non negotiable, each one closed a real hole:

- **`disableSignUp: true`.** Without it anyone could self register.
- **`input: false` on every `user.additionalFields`.** It defaults to `true`, so a caller could
  choose their own `role` in a sign-up body and mint themselves a SYSTEM_ADMIN.
- **better-auth's own `rateLimit.customRules`.** Nest's `ThrottlerGuard` cannot protect these routes:
  the library mounts them as middleware before the guard pipeline.
  The reset path is **`/request-password-reset`**, not `/forget-password`, which 404s in 1.6.
- **`databaseHooks` refuse SYSTEM_ADMIN at the write**, as defence in depth.
- Origin checking is off only when `AUTH_DISABLE_ORIGIN_CHECK === 'true'`. Never inferred from `NODE_ENV`.
- `bodyParser: false` in `main.ts` stays. `basePath` is the literal `/api/auth`. `hooks: {}` stays.
- `auth.instance.ts` runs before DI: it needs `import 'dotenv/config'` and the mail **singleton**.

Guard order, and the reason it works:

```
TrustedOriginThrottlerGuard   AuthModule's providers (imported first)
AuthGuard                     BetterAuthModule.forRoot()
PermissionsGuard              AppModule's OWN providers, which Nest processes last
```

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
