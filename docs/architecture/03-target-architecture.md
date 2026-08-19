# Target Architecture

> Part of the PixelVega refactor documentation. Index: [`docs/README.md`](../README.md).

The shapes every module lands in, per directive **D1**. `pmt-backend/CLAUDE.md` is the enforceable version of this document.
Read [`02-directives.md`](./02-directives.md) first: this document is what those directives produce.

---

## 1. Backend module template

`pmt-backend/src/projects/members/` is the worked example in this repo.

```
src/<module>/
├── spec/                            every *.spec.ts for this module
├── dto/<module>.dto.ts        Response DTOs, then Query DTOs, then Request DTOs
├── <module>.swagger.ts        one applyDecorators() function per endpoint
├── <module>.service.ts        all business logic
├── <module>.service.spec.ts   co-located, Prisma fully mocked
├── <module>.controller.ts     routing only
├── <module>.controller.spec.ts
├── <module>.module.ts
└── <helper>.ts                      pure units (spec lives in spec/)
```

**Controller.** Routing only: decorate, delegate, return. No Prisma, no business rules, no try/catch.
Static routes declared above dynamic ones. `import type` for types, to satisfy `isolatedModules`.

```ts
@ApiTags("Projects")
@ApiCookieAuth("better-auth.session_token")
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiCreateProjectDocs()
  @RequirePermissions(Permission.CREATE_PROJECT)
  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.projectsService.create(dto, user.id, user.role);
  }
}
```

**Swagger file.** Shared error sets composed once, one exported decorator per endpoint.

```ts
const serverError = ApiResponse({ status: 500, type: InternalServerErrorDto });
const commonErrors = [
  ApiResponse({ status: 400, type: BadRequestErrorDto }),
  ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
  serverError,
];
const staffErrors = [
  ...commonErrors,
  ApiResponse({ status: 403, type: ForbiddenErrorDto }),
];

export const ApiCreateProjectDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Create a project",
      description:
        "Always created in PLANNING status. Requires at least one Project Type tag. " +
        "A PROJECT_MANAGER caller is automatically staffed as an active PM.",
    }),
    ApiResponse({ status: 201, type: ProjectResponseDto }),
    ...staffErrors,
  );
```

**DTO file.** Three groups in order: Response, Query, Request. `@ApiProperty` with an `example` on
every response field, `@ApiPropertyOptional` on optionals, required response fields marked `!`.

**Service.** `private readonly logger = new Logger(X.name)`. Logs mutating actions. No try/catch
around `HttpException`s. `select:` or a shared `include` const on every query, never a raw row
returned. `$transaction` around multi step writes. Scope rules in named `assertCanX()` helpers, one
per rule.

**Module registration.** Every module is added to `AppModule.imports`. `PrismaModule` and
`AuditLogModule` are `@Global()`, so they are never re-imported per module.

## 2. Backend shared infrastructure

```
src/
├── env.validate.ts                        validateEnv(), called first in bootstrap()
├── config/
│   └── roles.config.ts                    ROLE_PERMISSIONS, the one role to capability map
├── auth/
│   ├── auth.types.ts                      AuthenticatedRequest, TypedAuthUser
│   ├── decorators/
│   │   ├── authenticated-user.decorator.ts
│   │   ├── public.decorator.ts
│   │   ├── require-permissions.decorator.ts
│   │   ├── require-any-permission.decorator.ts
│   │   └── roles.decorator.ts             identity rules only, not capability
│   └── guards/
│       ├── roles.guard.ts
│       └── permissions.guard.ts + spec
└── common/
    ├── dto/error-responses.dto.ts         400, 401, 403, 404, 409, 429, 500
    ├── filters/http-exception.filter.ts   AllExceptionsFilter + Prisma code mapping
    ├── validators/                        one custom rule per file, each with a spec
    └── utils/                             existing helpers, unchanged
```

`main.ts` gains, in order: `validateEnv()`, `helmet()`, `trust proxy`, a CORS allowlist parsed from
`CORS_ORIGINS` that fails closed, `useGlobalFilters(new AllExceptionsFilter())`,
`forbidNonWhitelisted: true` on the validation pipe, and `enableShutdownHooks()`. `bodyParser: false`
stays, because better-auth requires it.

## 3. Frontend module template

Presentation only, per directive D4.

```
types/<module>.ts                          types generated from or checked against the OpenAPI schema
lib/api/<module>.ts                        API client, one function per endpoint
hooks/<module>/use-<module>.ts             key factory + queries + mutations
components/<module>/
  <module>-list-view.tsx                   "use client", ~50 lines: state + hook + render
  <module>-table.tsx                       presentational
  <module>-columns.tsx                     column definitions
  <module>-row-actions.tsx                 per row dropdown
  <module>-form.tsx                        RHF + Zod, mirroring the DTO rules
  <module>-delete-dialog.tsx
```

```ts
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (params: ProjectsQuery) => [...projectKeys.lists(), params] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

export function useProjects(params: ProjectsQuery = {}) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsApi.getAll(params),
    placeholderData: keepPreviousData,
  });
}
```

A list view under D4 holds no `useMemo` that derives, sorts, filters, or aggregates. Sorting and
filtering are query params; the response arrives in the order it should render.

```tsx
export function ProjectsListView() {
  const {
    page,
    limit,
    debouncedSearch,
    filters,
    setPage,
    setLimit,
    setFilter,
  } = useTableState();
  const { data, isLoading } = useProjects({
    page,
    limit,
    search: debouncedSearch || undefined,
    ...filters,
  });

  return (
    <ProjectsTable
      data={data?.items ?? []}
      total={data?.total ?? 0}
      page={page}
      limit={limit}
      isLoading={isLoading}
      filters={filters}
      onPageChange={setPage}
      onLimitChange={setLimit}
      onFilterChange={setFilter}
    />
  );
}
```

## 4. Enforcement

`pmt-frontend/eslint.config.mjs` gains three rule groups, each landed as `warn` and flipped to `error`
once the existing violations are cleared:

1. **Design tokens.** No numeric palette classes, no raw colour literals, no inline `style`, no
   arbitrary `text-[...]`, spacing restricted to the scale.
2. **Dependency direction.** `lib/` never imports `components/`; `types/` imports only `types/`; one
   component module never imports another; one hook domain never imports another.
3. **Presentation only (D4).** No `.sort(` / `.reduce(` / `.filter(` inside `components/**`, and no
   locally declared status or priority label and tone maps. Both are backend responsibilities now.

---
