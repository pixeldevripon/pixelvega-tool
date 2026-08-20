# The dev seed: root account from the environment, small dataset, real photos

`pnpm seed` wipes the dev database and rebuilds it. This document is the spec for
the three changes made to it: the root account now comes from the environment
rather than from a checked in constant, every table is roughly a tenth of the
size it was, and every seeded person has a profile photo that actually loads.

Volume knobs live in `prisma/seed/config.ts`. Nothing below is a rule about
production data: this is test data, and the only reason it exists is so a screen
can be opened and judged.

---

## What is true when this is done

### The root account comes from the environment

`ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` are required environment
variables, declared in `src/env.validate.ts` and documented in `.env.example`.
They replace `SEED_ADMIN_EMAIL` and `SEED_ADMIN_NAME`, and there is no longer any
account identity written into a source file.

The seed reads all three. It creates exactly one `SYSTEM_ADMIN`, at that email
and that name, whose credential row holds a hash of `ADMIN_PASSWORD`, so that
account signs in with the password the operator chose. Every other seeded account
still shares `SEED_PASSWORD` from `config.ts`.

The seed refuses to run, with a named error and before it truncates anything, if
any of the three is missing or if `ADMIN_PASSWORD` is shorter than better-auth's
eight character minimum. A seed that half ran and left no usable login is worse
than a seed that did not start.

`SystemAdminBootstrapService` (the on-boot creation path for an empty database,
which is not the seed) reads the same three variables. Because the password is
now supplied, the account it creates is `ACTIVE`, verified, and not forced
through a reset, and no invite email is sent. Previously it invented a password
nobody was told and emailed a set-password link, which meant first boot depended
on SMTP being configured.

The seed's final report prints one login per role. For the system admin it prints
`from ADMIN_PASSWORD` rather than the value, so a real password is not written
into terminal scrollback or a CI log.

The root account claims its email before any fixed account is created, so it
always holds exactly the address `ADMIN_EMAIL` names. A fixed account whose
address is already taken falls back through the same `uniqueEmail` helper the
generated accounts use, and the report prints whatever it resolved to. Two
consequences worth knowing:

- The fixed `ADMIN` login moved from `admin@pixelvega.com` to
  `ops-admin@pixelvega.com`. `ADMIN_EMAIL` is very commonly the former, and the
  fallback would otherwise have produced `admin2@pixelvega.com` beside a
  `SYSTEM_ADMIN` at `admin@pixelvega.com`: two near identical addresses at two
  different permission levels is a sign-in nobody gets right first time.
- Setting `ADMIN_EMAIL` to any other fixed address (`pm@`, `client@`) still
  works. That role's fixed login shifts by one character and is printed.

### The system admin cannot be deleted

Already enforced in two places, both of which stay:

- `UsersService.remove` throws for a `SYSTEM_ADMIN` target whoever the caller is,
  including the system admin itself.
- `ProfilesService.deleteOwnAccount` throws through the `mayDeleteOwnAccount`
  predicate, which is the same predicate the `canDeleteAccount` capability flag
  is built from, so the account screen never offers the button.

What this change adds is the seed side of the same guarantee. The seed soft
deletes a few accounts so the `deletedAt` filters have rows to exclude, and the
choice of who is deletable is now a pure function, `softDeletableUsers`, with a
spec. It returns only `DEVELOPER`, `DESIGNER` and `CLIENT` rows, never a
protected id, and never a `SYSTEM_ADMIN` even if one were passed in as
unprotected.

### Volumes

Totals per role, each **including** the one fixed test account that role always
gets (`admin@pixelvega.com`, `pm@pixelvega.com`, and so on), plus the single root
account on top:

| Role              | Total rows |
| ----------------- | ---------- |
| `SYSTEM_ADMIN`    | 1          |
| `ADMIN`           | 3          |
| `PROJECT_MANAGER` | 4          |
| `DEVELOPER`        | 10        |
| `DESIGNER`        | 5          |
| `CLIENT`          | 10         |

33 users in total. Projects: 20, two in each of the ten statuses, so every status
filter has rows and no status is empty. Six of those belong to the fixed test
accounts, so each test login opens onto real work.

Everything hanging off a project shrank with it, and the previous floor of 100
rows per table is gone: it was the reason `LeaveType` carried 104 rows, 90 of
which were `Bereavement Leave Category 7` and its siblings. `leaveTypes` and
`blockerReasons` are now the real curated lists and nothing else.

The seed's report no longer warns about tables under 100 rows. It flags an
**empty** table instead, which is the condition that actually means a seeder
silently produced nothing.

### Every seeded person has a photo

`avatarUrl` on every fixed account and on most generated ones points at a real
portrait that loads. The portrait matches the row's `gender` where that is set,
and no two accounts share one.

`avatarPublicId` stays `null` on every seeded row, because these are not assets
in this workspace's Cloudinary account. A non-null public id that Cloudinary does
not hold would make the replace path in `ProfilesService.updateAvatar` try to
destroy something that is not there. Both `updateAvatar` and `removeAvatar`
already branch on `avatarPublicId` being present, so a seeded photo replaces and
removes cleanly.

A deliberate minority of generated accounts keep `avatarUrl: null`, because the
initials fallback is a state the UI has to get right too.

## Out of scope

- **Project document files.** `ProjectDocument.fileUrl` still points at a
  Cloudinary demo path that 404s. Nothing in the dashboard renders or downloads
  one yet, and a seed cannot invent a real 3 MB PDF.
- **Uploading the seeded avatars to Cloudinary.** It would tie `pnpm seed` to a
  network round trip and to credentials, and buy nothing the null public id does
  not already cover.
- **`next.config.ts` image hosts.** Avatars render through the shadcn `Avatar`
  primitive, which is a plain `<img>`, so the `remotePatterns` allowlist does not
  apply to them and stays as it is.
- **A system admin suspending itself.** `UsersService.update` lets a
  `SYSTEM_ADMIN` actor change its own `status`, which is a lockout waiting to
  happen. It is a separate defect from deletion and is not fixed here.

---

## Checklist

- [x] Read the seed, the bootstrap service, the env validation, and the
      protections that already exist on the system admin
- [x] `config.ts`: root account read from `ADMIN_EMAIL` / `ADMIN_NAME` /
      `ADMIN_PASSWORD`, validated before anything is truncated
- [x] `config.ts`: role totals 3 / 4 / 10 / 5 / 10, projects 20, and every
      dependent knob scaled down
- [x] `config.ts`: avatar source, so the photo pool is a knob like everything else
- [x] `users.ts`: role totals are totals, the fixed test account counting against
      each one
- [x] `users.ts`: the root account's credential row holds a hash of
      `ADMIN_PASSWORD`, not the shared seed password
- [x] `users.ts`: a photo on every fixed account, most generated ones, gender
      matched and unique
- [x] `users.ts`: `softDeletableUsers` extracted as a pure function
- [x] `projects.ts`: status plan sums to 20, two per status
- [x] `leave.ts`: no `rand.pick` on an empty pool when there are no extra leave
      types, and balance breadth is a knob
- [x] `reference.ts`, `time-tracking.ts`, `work-reports.ts`: the hardcoded sample
      sizes tuned for 120 projects moved into `config.ts`
- [x] `seed.ts`: report flags empty tables, and prints the root login without
      echoing its password
- [x] `env.validate.ts` + spec: the three `ADMIN_*` variables, with a length
      bound on the password
- [x] `.env.example`: renamed, documented, in step with the validator
- [x] `system-admin-bootstrap.service.ts`: same variables, env password, active
      account, no invite email
- [x] Specs: `system-admin-bootstrap.service.spec.ts` (new),
      `soft-deletable-users.spec.ts` (new), `system-admin-from-env.spec.ts`
      (new), `env.validate.spec.ts` (updated)
- [x] Runbook and `docs/refactor/03-progress.md` updated
- [x] `pnpm seed` run against the dev database, row counts checked
- [x] Gate: lint, typecheck, test, build
- [x] Gate: `test:e2e`, backend. 54 tests in 3 suites against `pixelvega_test`.
      `pmt-frontend`'s Playwright suite is NOT run: every spec in `e2e/tests/`
      still belongs to the island-tours reference app (destinations, hubs,
      collections) and its `auth.setup.ts` signs in at `admin@islandtours.com`.
      It cannot pass on this repo, with or without this change
- [ ] Security review and code review (the loop's stages 7 and 8, awaiting the
      go ahead)
