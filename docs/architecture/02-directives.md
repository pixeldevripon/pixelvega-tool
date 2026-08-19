# The Five Directives

> Part of the PixelVega refactor documentation. Index: [`docs/README.md`](../README.md).

Binding constraints on every phase of the refactor, and on every change made to this repo from now
on. They came from the product owner after the assessment in
[`01-assessment.md`](./01-assessment.md) was written. Where any other document disagrees with this
one, this one wins.

The shapes these produce are in [`03-target-architecture.md`](./03-target-architecture.md).

---

## D1. The backend mirrors `island-tour-development/backend`

Not "is inspired by". **Mirrors.** Folder structure, file naming, module anatomy, guard order, DTO
conventions, Swagger conventions, service conventions, spec placement, and code style all match the
reference. When a question comes up, the answer is whatever that repo does, and the answer is found by
reading it rather than by reasoning from first principles.

The most visible consequence: **modules live at `src/<module>/`, not `src/modules/<module>/`.** The
reference has no `modules/` wrapper directory, so neither does this repo.

| Today                                              | Target                                |
| -------------------------------------------------- | ------------------------------------- |
| `src/modules/projects/projects.service.ts`         | `src/projects/projects.service.ts`    |
| `src/modules/projects/blockers/blocker.service.ts` | `src/blockers/blockers.service.ts`    |
| `src/modules/leave/leave-requests.service.ts`      | `src/leave/leave-requests.service.ts` |
| `src/modules/uploads/cloudinary.service.ts`        | `src/uploads/cloudinary.service.ts`   |

A module keeps its own sub concern files flat inside its folder rather than nesting a subdirectory per
feature, matching `src/tours/` (which holds `tours.*`, `tours-children.*`, `quality-score.ts`,
`overnight.ts`, `card-teaser.ts`, and their specs side by side) and `src/bookings/`. Only `dto/` is a
subdirectory.

Where a genuine PixelVega concept has no counterpart in the reference, the _shape_ is mirrored and the
_content_ is ours. Never invent a reference feature that PixelVega has no product need for, and never
invent a PixelVega layout the reference does not use.

## D2. Authorization is a granular permission gate

Role checks are replaced by permission checks. `@Roles([...])` stops being the gate; `Permission` does.

```
ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard
```

- A real Prisma `enum Permission` in `prisma/enums.prisma`, one value per capability.
- `src/config/roles.config.ts` exporting `ROLE_PERMISSIONS: Record<Role, Permission[]>`, the single
  map from role to capability set. `SYSTEM_ADMIN` and `ADMIN` are strict supersets of every lower role.
- `src/auth/decorators/require-permissions.decorator.ts` (AND semantics) and
  `require-any-permission.decorator.ts` (OR semantics), both `SetMetadata` one liners.
- `src/auth/guards/permissions.guard.ts` reading both metadata keys and resolving the caller's
  effective set through one service, so the resolution rule lives in exactly one place.
- `GET /users/me/permissions` returning the caller's effective set, so the frontend gates its UI from
  the server's answer rather than from a hardcoded role check.

Two rules that keep this honest:

1. **`@RequirePermissions()` on endpoints, not `@Roles()`.** `@Roles()` survives only where a rule is
   genuinely about identity rather than capability (the SYSTEM_ADMIN root account protections).
2. **The permission gate is coarse; project scoping stays in the service.** A permission answers "may
   this role ever do this". Whether _this_ caller may do it to _this_ project is still an
   `assertCanX()` helper in the service, because it depends on `ProjectMember` rows. The reference
   splits it the same way: `PermissionsGuard` for the grant, service for the ownership check.

The existing `Roles` wrapper that silently unions in `SYSTEM_ADMIN`/`ADMIN` is retired by this change.
That union becomes explicit in `ROLE_PERMISSIONS`, where it is readable instead of implied.

## D3. The Prisma schema is split by domain

`prisma/schema.prisma` keeps only the generator and datasource blocks plus a comment index. Every model
moves to a domain file, and Prisma 7 merges the folder automatically. Migrations are unaffected by the
split.

```
prisma/
├── schema.prisma          generator + datasource + the index comment
├── enums.prisma           every enum, including the new Permission
├── user.prisma            User, Session, Account, Verification, PasswordResetCode
├── profiles.prisma        EmployeeProfile, ClientProfile
├── projects.prisma        Project, ProjectTypeTag, ProjectMember, ProjectActivity
├── documents.prisma       ProjectDocument
├── time-tracking.prisma   TimeEntry, MeetingTimeEntry
├── work-reports.prisma    DailyWorkReport, DailyProjectEntry
├── blockers.prisma        Blocker, BlockerReason
├── reviews.prisma         ProjectInternalReview, ClientFeedback, AdditionalRequirement
├── leave.prisma           LeaveType, LeaveRequest, LeaveBalance, Holiday
├── notifications.prisma   Notification
├── ai.prisma              AiJob, AiTemplate, ProjectStatusReport
└── audit-log.prisma       AuditLog
```

`prisma.config.ts` points `schema` at `'prisma/'` rather than at the single file.

## D4. The backend serves everything; the frontend presents it

**The frontend performs no computation, no transformation, and no derivation.** It renders what the API
returns and sends what the user typed. Nothing else.

That means the response payload is complete: every value a screen displays is a field on the response,
already computed, already formatted where formatting is a business decision rather than a locale
preference.

| Belongs to the backend                                                                | May stay in the frontend                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Derived numbers (`remainingHours`, `daysOpen`, `resolutionTime`, totals, percentages) | Locale date and number rendering via `Intl`                   |
| Sorting and ordering, including the dashboard sort                                    | Which column the user chose to sort by, sent as a query param |
| Filtering, grouping, and pagination                                                   | The filter values the user picked                             |
| Status and priority display labels, and the tone or severity that goes with them      | Mapping a tone name the API returned onto a CSS class         |
| Whether an action is permitted (`canEdit`, `canArchive`, `canApprove`)                | Hiding a button when the API said the action is not permitted |
| Aggregates and roll ups of any kind                                                   | Nothing                                                       |
| Reducing a payload for a role, for example the CLIENT projection                      | Nothing                                                       |

The frontend must not reimplement a rule the backend already owns. Two examples from today's code that
this directive removes: `getStatusTone()` and `getPriorityTone()` in `projects-view.tsx`, which encode a
business judgment about severity in the client, and `formatEnumLabel()`, which turns `READY_FOR_WORK`
into "Ready For Work" by string manipulation rather than reading a label the API supplied.

The test for whether a computation belongs in the backend: **if two clients would have to implement it
identically, it belongs in the backend.** A second consumer of this API, a mobile app or a report
export, must not have to re-derive anything.

## D5. Validation is owned by the backend

The DTO is the specification. `class-validator` decorators on the request DTO are the authoritative
rule set, and the global `ValidationPipe` runs `whitelist: true`, `forbidNonWhitelisted: true`, and
`transform: true` so an unknown field is a 400 rather than a silent strip.

- Rules that need more than the built in decorators become a custom validator in
  `src/common/validators/`, one file per rule with a co-located spec, mirroring the reference's
  `is-local-date.validator.ts` and `is-iana-timezone.validator.ts`.
- Numeric query params carry `@Type(() => Number)`. Boolean query params carry an explicit
  `@Transform`. Enum fields use `@IsEnum` against the Prisma enum, never a string union.
- Every free text field that reaches the database, an email, a Slack message, or an AI prompt carries a
  length bound.

**The frontend's Zod schema is a convenience, never the gate.** It exists so a user sees a problem
before a round trip. It must state the same rules as the DTO, and where the two disagree the backend
wins and the frontend is the bug. A rule that cannot be expressed in Zod is simply not checked client
side, and the backend's 400 is surfaced through `humane-error.ts` instead.

---
