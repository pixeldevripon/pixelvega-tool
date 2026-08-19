---
name: pmt-backend-module
description: Use when adding, changing or reviewing a module in pmt-backend. Walks the exact order of work for a NestJS module in this repo (folder placement, one DTO file, mapper, capabilities, enum display objects, swagger, specs) and the checks that catch the mistakes this codebase has actually made.
---

# Building a module in pmt-backend

`pmt-backend/CLAUDE.md` is the contract and loads automatically. This is the walkthrough: the order
of work, and the specific mistakes already made here.

## The order matters

Doing these out of order means writing the DTO twice.

### 1. Decide the folder from the ROUTE

`projects/:projectId/widgets` becomes `src/projects/widgets/`. Not from the concept, from the URL.
A sub-resource of projects never becomes a top level module.

### 2. One `dto/<module>.dto.ts`

Three banner-separated sections, always this order:

```ts
// ═══ Response ═══
// ═══ Query ═══
// ═══ Request ═══
```

Every response field carries an `example`. Enums are `EnumDisplayDto`, never the Prisma enum.
Add a `<Module>CapabilitiesDto` with one flag per action a screen actually gates.

### 3. Add labels and tones for any new enum

In `common/utils/enum-display.util.ts`, typed `Record<TheEnum, EnumDisplayEntry>`. The compiler then
refuses to build until every member has both. Extend the spec's `MAPS` table in the same commit.

Tone is a judgment about the business, not styling. Reserve `danger` for outcomes that are actually
bad: requested changes on a review are `warning`, because a board where most reviews ask for changes
would otherwise be all red.

### 4. Write the mapper before wiring anything

`<module>.mapper.ts`, pure: it takes a row and a **context object**, never a database. That is what
makes the capability rules testable without a Nest module.

```ts
export type WidgetContext = { managesProject: boolean };

export function toWidgetResponse(widget: WidgetWithRelations, context: WidgetContext) { ... }
```

Resolve the context ONCE per request, not once per row. For a list spanning projects, cache per
project id.

### 5. Wire the service, then type the swagger, then run the FULL suite

If an existing service spec breaks, the mapper changed behaviour rather than shape. That ordering is
designed to surface exactly that.

## Checks that catch what has actually gone wrong here

Run these before saying a module is done.

**No raw enum survived into a response**

```bash
grep -rn "enum: [A-Z]" --include="*.dto.ts" src | grep -v "IsIn\|IsEnum"
```

**No boolean query param uses the broken transform**

```bash
grep -rn "@Type(() => Boolean)" --include="*.ts" src   # must be empty
```

**Every free text field has a bound**

Any `@IsString()` with no `@MaxLength` reaching the database is a defect.

**No public mapped method is reused as an internal lookup**

If `findOne` returns display objects and `update()` calls it to fetch the row it compares against,
every `row.role === Role.X` check silently becomes false. Keep a private `get<X>OrThrow`.

**Every 2xx has a schema**

`test/openapi.e2e-spec.ts` asserts this against the generated document. It has already caught seven.

## Things that look like good ideas and are not

- **A second `CloudinaryService`, or a per feature options file.** Use `uploadOptions({ maxSizeMb, allow })`.
- **A hand rolled auth endpoint.** better-auth owns sign-in, forgot, reset and change. There is no
  auth controller and there must not be one.
- **A private copy of `assertManagesProject`.** There were twelve. Use `ProjectScopeService`.
- **A `RequiredWhen` custom validator.** `@IsOptional` short circuits it, so it never runs in the only
  case it exists for. Use `@ValidateIf` + `@IsNotEmpty`. `common/validators/README.md` explains.
- **`@Type(() => Boolean)`.** `Boolean('false')` is `true`.

## Migrations

`prisma migrate dev` needs a TTY an agent session does not have. Hand write it:

```bash
mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_what_it_does
# write migration.sql, then:
npx prisma migrate deploy && npx prisma generate
```

## The gate

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build
```

Then tick `docs/refactor/02-checklist.md` from evidence, in the same PR.
