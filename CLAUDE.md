# PixelVega PMT: CLAUDE.md

Guidance for Claude Code when working in this repository. Package-level detail lives in
`pmt-backend/CLAUDE.md` and `pmt-frontend/CLAUDE.md`; this file is the repo-wide contract.

> **This repo is mid-migration.** Everything is documented under **`docs/`**, indexed by
> [`docs/README.md`](docs/README.md): the assessment, the five directives, the target architecture,
> the nine phase plan, and the checklist. Read the phase's section in
> `docs/refactor/01-plan.md` before starting it, and **tick `docs/refactor/02-checklist.md` in the
> same PR as the work**. A stale checklist is worse than no checklist, because the next person trusts
> it.
>
> When existing code disagrees with the rules below, the rules describe where the code is going: write
> new code to the rules, and say plainly when you are leaving old code as-is rather than silently
> matching it.

---

## The five directives

Binding constraints on everything in this repo. Full text in `docs/architecture/02-directives.md`.

**D1. The backend mirrors `../island-tour-development/backend`.** Not "is inspired by". Mirrors.
Folder structure, file naming, module anatomy, guard order, DTO and Swagger conventions, service
conventions, spec placement, code style. When a question comes up, the answer is whatever that repo
does, and you find it by **reading that repo**, not by reasoning from first principles. Modules live
at `src/<module>/`, never `src/modules/<module>/`, because the reference has no `modules/` wrapper.

**D2. Authorization is a granular permission gate.** `@RequirePermissions(Permission.X)` on endpoints,
not `@Roles()`. Guard order is `ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard`. The
permission answers "may this role ever do this"; whether _this_ caller may do it to _this_ project
stays an `assertCanX()` helper in the service.

**D3. The Prisma schema is split by domain.** `schema.prisma` holds only the generator, the datasource,
and an index comment. Every model lives in a domain `.prisma` file, merged by Prisma 7.

**D4. The backend serves everything; the frontend presents it.** The frontend performs no computation,
no transformation, and no derivation. Every value a screen shows is a field on the response, already
computed. Derived numbers, ordering, filtering, grouping, aggregates, display labels and tones, and
capability flags (`canEdit`, `canArchive`) are all backend responsibilities. The test: **if two clients
would have to implement it identically, it belongs in the backend.**

**D5. Validation is owned by the backend.** The DTO is the specification. `class-validator` decorators
plus `whitelist`, `forbidNonWhitelisted`, and `transform` are the gate. Rules the built in decorators
cannot express become a custom validator in `src/common/validators/` with a co-located spec. The
frontend's Zod schema is a convenience so a user sees a problem before a round trip; where it disagrees
with the DTO, the backend wins and the frontend is the bug.

---

## What this is

An internal project-management tool for a web agency. Two packages, no monorepo tooling beyond a
root orchestrator:

| Package        | What it is                                                      | Port |
| -------------- | --------------------------------------------------------------- | ---- |
| `pmt-backend`  | NestJS 11 API. Owns the database, auth, and every business rule | 3000 |
| `pmt-frontend` | Next.js 16 dashboard. Pure API client (no database, no secrets) | 3001 |

Six roles: `SYSTEM_ADMIN · ADMIN · PROJECT_MANAGER · DEVELOPER · DESIGNER · CLIENT`.
Domain: projects and staffing, time tracking, daily work reports, blockers, internal reviews,
client feedback, additional requirements, leave, audit logging, Slack integration, AI summaries.

### Reference implementations

Two sibling repos are the pattern source for this migration. When a convention here is ambiguous,
**read the reference rather than guessing**, and cite the file you copied from:

| Repo                                   | Use it for                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `../island-tour-development/backend`   | NestJS module shape, swagger files, response DTOs, guards, global filter, env validation, spec style               |
| `../tripwheel-x-islandtours-dashboard` | Next.js dashboard: `lib/api/fetch.ts`, query hooks, component decomposition, data-table, design-token ESLint rules |

`../island-tour-development/backend/src/categories/` and
`../tripwheel-x-islandtours-dashboard/components/categories/` are the two canonical modules. Copy
their shape.

---

## Commands

```bash
pnpm install:all              # install root + both packages
pnpm dev                      # backend :3000 and frontend :3001 together
pnpm lint                     # eslint --fix, both packages
pnpm typecheck                # tsc --noEmit, both packages
pnpm test                     # backend Jest + frontend Vitest
pnpm build                    # backend nest build, then frontend next build
pnpm prisma:generate          # regenerate the Prisma client after any schema edit
pnpm seed                     # wipe and rebuild the full test dataset
```

Per-package commands are in each package's `CLAUDE.md`. Use `pnpm` everywhere, never `npm` or `yarn`.

---

## Backend rules

### Module shape

Every module matches this, no exceptions:

```
src/<module>/                        NOT src/modules/<module>/ (D1)
├── dto/<module>.dto.ts              ALL DTOs: Response, then Query, then Request, in that order
├── <module>.swagger.ts              one applyDecorators() function per endpoint
├── <module>.service.ts              all business logic
├── <module>.service.spec.ts         co-located, Prisma fully mocked
├── <module>.controller.ts           thin routing only
├── <module>.controller.spec.ts
├── <module>.module.ts
└── <helper>.ts + <helper>.spec.ts   pure units, with a co-located spec
```

**Subdirectories are allowed for organization.** The reference keeps most modules flat, and small
modules should stay that way, but a module large enough that its file list is hard to scan is better
grouped than flat. What matters is that a spec sits beside the file it tests, wherever that file
lives, and that the grouping means something (`dto/`, `mappers/`, `jobs/`) rather than being a dumping
ground.

- **`@/` path alias for every internal import.** `@prisma/client` and other real packages are the
  exception. A new `../../` chain is a defect.
- **Controllers are routing only.** No Prisma calls, no business rules, no try/catch. Decorate,
  delegate, return.
- **Static routes before dynamic ones.** `@Get('mine')` must be declared above `@Get(':id')`, or
  Nest matches `mine` as an `:id`.
- **Services** carry `private readonly logger = new Logger(<Service>.name)` and log mutating admin
  actions. No try/catch around `HttpException`s: Nest handles them, and the global filter maps
  Prisma error codes.
- **Prisma**: always `select:` or a shared `include` const, never a raw row returned to the client.
  Wrap multi-step writes in `$transaction`. Reuse `paginate()` from `@/common/utils/pagination.util`.
- **Register the module in `AppModule.imports`.** `PrismaModule` and `AuditLogModule` are `@Global()`,
  so do not re-import them per module.

### DTO and Swagger conventions

- `@ApiProperty` with an `example` on every response field, `@ApiPropertyOptional` on optionals,
  required response fields marked `!`.
- Numeric query params need `@Type(() => Number)`.
- Paginated responses are `{ items, total, page, pageSize }`.
- Swagger decorators live in `<module>.swagger.ts`, composed with `applyDecorators()`. Controllers
  carry `@ApiTags` plus the composed decorator, never a wall of inline `@ApiResponse`.
- Error responses use `type:` (never `schema:`) from `@/common/dto/error-responses.dto`.

### Authorization

```
ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard
```

- Every route is protected by default. `@Public()` opts out, and each one needs a reason.
- **Gate with `@RequirePermissions(Permission.X)`, not `@Roles()`** (D2). `@RequireAnyPermission(...)`
  when one of a set suffices. `ROLE_PERMISSIONS` in `src/config/roles.config.ts` is the single map from
  role to capability, and `SYSTEM_ADMIN` and `ADMIN` are strict supersets of every lower role, stated
  explicitly there rather than unioned in silently by a decorator wrapper.
- `@Roles()` survives only where a rule is about identity rather than capability: the SYSTEM_ADMIN root
  account protections in `UsersService`.
- Use `Role` and `Permission` enum members from `@prisma/client`, never string literals.
- **The permission gate is coarse; project scoping stays in the service.** A permission answers "may
  this role ever do this". Whether this caller may do it to this project is an `assertCanX()` helper,
  one per rule, because it depends on `ProjectMember` rows.
- Ownership rules that deliberately survive admin (time-entry pause/resume/stop, leave-request cancel)
  must stay that way.
- CLIENT reads use the reduced projection, and that projection is a response DTO class, not a hand
  written `select`.
- `GET /users/me/permissions` is what the frontend gates its UI from. It never gates from a role string.

### Critical rules, never break these

1. **`bodyParser: false` in `main.ts` stays.** better-auth parses the body itself; re-enabling it
   breaks every auth route.
2. **better-auth's `basePath` is the literal `/api/auth`**, not composed from the global prefix. The
   library mounts middleware in `onModuleInit()`, before `setGlobalPrefix` runs.
3. **`hooks: {}` must stay in the `betterAuth(...)` config**, or `@Hook()` providers throw at startup.
4. **`auth.instance.ts` must keep its `import 'dotenv/config'`.** It runs before `ConfigModule`. Any
   other file that reads `process.env` at module load has the same requirement.
5. **No `url` in `schema.prisma`'s datasource** (Prisma 7). The connection string lives in
   `prisma.config.ts`, and every `PrismaClient` passes an explicit `PrismaPg` adapter.
6. **`prisma migrate dev` needs a TTY.** In an agent session, hand-write the migration folder and
   `migration.sql`, then run `prisma migrate deploy`.
7. **Password hashing and signed tokens reuse `better-auth/crypto`.** Do not add a second crypto
   dependency.
8. **Never let the frontend decide authorization.** Frontend gating is UX; the backend is the control.
9. **Keep `.env.example` in sync** with every env var the code reads, and declare it in
   `src/env.validate.ts` so a missing value fails at boot rather than at first use.

---

## Frontend rules

### Server/client boundary

`page.tsx` is a **Server Component** that renders the page header and the view. `"use client"` sits
at the lowest leaf that genuinely needs state, an effect, or a browser API.

```
app/(dashboard)/dashboard/projects/page.tsx    Server Component: title + <ProjectsListView/>
components/projects/projects-list-view.tsx     "use client": owns list state, calls the hook
components/projects/projects-table.tsx         presentational
components/projects/project-row-actions.tsx    "use client": dropdown, dialogs
```

Never put `"use client"` on a `page.tsx` or a layout.

### Data fetching

**TanStack Query for everything.** No `useEffect` + `fetch` + `useState(isLoading)` machines.

```ts
// hooks/projects/use-projects.ts
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (params: ProjectsQuery) => [...projectKeys.lists(), params] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};
```

- Every query and every invalidation uses the key factory. Inline key arrays drift and silently stop
  matching.
- Paginated lists set `placeholderData: keepPreviousData`.
- Mutations invalidate exactly what they changed, and toast via `sonner`.
- All HTTP goes through `apiFetch` in `lib/api/fetch.ts`, which sends `credentials: 'include'` and
  throws `ApiError` whose `message` is **safe to toast verbatim**. Raw technical text never reaches a
  user.

### Module file structure

```
types/<module>.ts                          all TypeScript types for the domain
lib/api/<module>.ts                        the API client, one function per endpoint
hooks/<module>/use-<module>.ts             query keys, queries, mutations
components/<module>/
  <module>-list-view.tsx                   "use client", owns list state
  <module>-table.tsx                       presentational table
  <module>-columns.tsx                     column definitions
  <module>-row-actions.tsx                 per-row dropdown
  <module>-form.tsx                        create/edit form
  <module>-delete-dialog.tsx               confirmation
  <module>-detail-shell.tsx                shared breadcrumb/title/sub-nav for [id]/*
```

**No component over ~400 lines.** Past that, extract along the seams above.

### Presentation only (D4)

The frontend renders what the API returns and sends what the user typed. Nothing else.

- **No derivation, sorting, filtering, grouping, or aggregation.** Sorting and filtering are query
  params; the response arrives in the order it should render.
- **No label maps, no tone maps, no severity judgments.** A status arrives as
  `{ value, label, tone }`. Mapping a tone name onto a CSS class is the client's only job.
- **No permission logic.** The response carries `canEdit` / `canArchive` / `canApprove`. Hide what the
  server says is not permitted; never re-derive it from a role.
- A list view holds no `useMemo` that computes. If you are reaching for `.sort(`, `.reduce(`, or
  `.filter(` under `components/`, the work belongs in the backend.
- `Intl` date and number formatting is allowed, because it is a locale preference rather than a
  business rule.

### Forms

React Hook Form + Zod, always. `zodResolver`, a schema per form, `z.infer` for the values type. No
hand-rolled validation state, no `any`.

The Zod schema **mirrors the backend DTO's rules** and is a convenience, never the gate (D5). Where the
two disagree, the backend is right and the schema is the bug. A rule Zod cannot express is simply not
checked client side, and the backend's 400 surfaces through `humane-error.ts`.

### Styling

- shadcn/ui primitives under a real `components.json`. Add components with the CLI, do not hand-copy.
- **Semantic tokens only.** No numeric palette classes (`bg-blue-500`), no raw `#hex`/`rgb()`/
  `oklch()`, no inline `style` objects, no arbitrary `text-[13px]`. Every colour is a token in
  `globals.css`, and spacing comes from the scale. These become ESLint errors once the design-token
  config lands, so write to them now.
- Icon-only buttons carry an accessible label.

### Dependency direction

`types/` imports only `types/`. `lib/` never imports `components/`. A `components/<module>/` folder
never imports another module's folder; shared UI moves to `components/common/`. A `hooks/<domain>/`
never imports another hook domain.

---

## Testing

| Suite           | Tool                                    | Location                            | Command                  |
| --------------- | --------------------------------------- | ----------------------------------- | ------------------------ |
| Backend unit    | Jest + ts-jest, Prisma fully mocked     | co-located `*.spec.ts`              | `pnpm test:backend`      |
| Backend API E2E | Jest + supertest, real test DB          | `pmt-backend/test/**/*.e2e-spec.ts` | `pnpm test:e2e:backend`  |
| Frontend unit   | Vitest + happy-dom + Testing Library    | co-located `*.test.tsx`             | `pnpm test:frontend`     |
| Frontend E2E    | Playwright, storage-state auth per role | `pmt-frontend/e2e/tests/`           | `pnpm test:e2e:frontend` |

Every branch, every guard, and every thrown exception gets a case. A test that still passes when the
implementation is deleted is not a test, so delete it. Never assert only that a mock was called when
you can assert the value it was called with.

---

## Subagents

Defined in `.claude/agents/`. Launch them by name with the Agent tool:

| Agent                    | Use it for                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `code-reviewer`          | DRY/SOLID/pattern review of a new module, service, or significant change                 |
| `frontend-code-reviewer` | RSC boundary, query wiring, composition, token compliance                                |
| `security-reviewer`      | Anything touching auth, roles, ownership scoping, uploads, Slack/AI, or anonymous routes |
| `unit-test-writer`       | Jest specs for services and controllers, Vitest specs for components and hooks           |
| `e2e-test-writer`        | Multi-step flows and concurrency invariants against real infrastructure                  |
| `performance-reviewer`   | A slow screen, a new list view, or new Prisma includes on a hot path                     |
| `migration-reviewer`     | Conformance of a module against `docs/architecture/`                                     |

They keep project-scoped memory under `.claude/agent-memory/<agent>/`, which is committed and shared.

## Skills

Vendored under `.claude/skills/` and `.agents/skills/`, pinned in `skills-lock.json`:

`shadcn` · `next-best-practices` · `next-cache-components` · `vercel-react-best-practices` ·
`better-auth-best-practices` · `better-auth-security-best-practices` ·
`email-and-password-best-practices` · the `openspec-*` spec-driven workflow (with `/opsx:*` commands).

Load the relevant skill before writing code in its area: `shadcn` before adding a UI primitive,
`better-auth-security-best-practices` before touching the auth surface.

---

## Documentation

Every repo-wide doc lives under `docs/`, organized by folder, and **is written in Markdown**. Generate
an HTML build only when explicitly asked for one, and never treat it as the source of truth while a
Markdown original exists.

| Kind of doc                                    | Location                                 |
| ---------------------------------------------- | ---------------------------------------- |
| Repo-wide architecture, decisions, conventions | `docs/architecture/`                     |
| Refactor and migration planning                | `docs/refactor/`                         |
| An architecture decision record                | `docs/decisions/NNNN-short-title.md`     |
| A feature's design or business rules           | `<package>/docs/features/<feature>/`     |
| How to run or operate something                | the package's `README.md` or runbook     |
| Instructions to Claude Code                    | a `CLAUDE.md`, never a doc under `docs/` |

Keep the doc in the same PR as the change it describes.

## Git and hygiene

- **Every change goes on its own branch and lands as a PR.** Never commit straight to `main`.
- `pre-commit` runs lint-staged; `pre-push` runs lint, typecheck, test, and build. Do not use
  `--no-verify` except in a genuine emergency.
- **`CLAUDE.md` files are committed, not gitignored.** They are shared team context. The backend's
  `.gitignore` currently excludes `CLAUDE.md` and `docs/`, and the refactor plan removes those lines.
- Never commit a real `.env`. Only `*.example` files are tracked.
- Commit messages are plain descriptions of the change, with no attribution trailer.

## Code style

Favour straightforward, readable code over clever or maximally compact code: explicit names, simple
conditionals, small functions that do one obvious thing. Comments explain **why**, never what. A
comment restating the line below it is noise; a comment naming the constraint that forced an
unobvious choice is the most valuable line in the file.

**Never use a hyphen or em dash (`-`, `—`) as a clause connector in prose you write in this project**:
markdown docs, code comments, Swagger `description`/`summary`, and Postman descriptions. Rewrite into
separate clauses, a colon, or parentheses. Hyphenated compound words (`role-gated`, `server-side`) are
fine, and so are list bullets and table rules. This rule is about the punctuation-as-pause habit.
