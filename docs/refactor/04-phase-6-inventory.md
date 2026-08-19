# Phase 6 Inventory: what the frontend computes today

> Part of the PixelVega refactor documentation. Index: [`docs/README.md`](../README.md).

Directive **D4** says the backend serves everything and the frontend presents it.
This is the audit that turns that principle into a backlog: every computation in
`pmt-frontend`, and where it should live instead.

**Read this before phase 6 starts.** Some of it is genuine presentation logic
that should stay. The classification below is a proposal, not a decision, and the
"keep" column is the part most worth arguing with.

---

## The measured surface

| What                                                             | Count                        |
| ---------------------------------------------------------------- | ---------------------------- |
| `useMemo` / `.sort(` / `.reduce(` occurrences                    | 55                           |
| Client side `.sort(` calls, across 14 files                      | 18                           |
| Aggregations (`.reduce`, `.filter().length`, hand summed totals) | 16                           |
| `canX` permission booleans derived in components                 | 39 declarations, 35 distinct |
| Role comparisons (`user.role === "..."`)                         | 70                           |
| Duplicated `formatDate` / `formatDateTime` declarations          | 11 each                      |
| Duplicated `formatEnumLabel` declarations                        | 5                            |
| Tone functions encoding severity judgments                       | 2                            |

Concentration, by file:

| File                          | Hits |
| ----------------------------- | ---- |
| `project-detail-view.tsx`     | 9    |
| `daily-work-reports-view.tsx` | 7    |
| `blockers-section.tsx`        | 5    |
| `leave-requests-view.tsx`     | 4    |

---

## Category 1: permission logic. Move, highest priority

39 `canX` booleans are assembled in components from role string comparisons, for
example:

```ts
const canManageProjects =
  currentUser?.role === "SYSTEM_ADMIN" ||
  currentUser?.role === "ADMIN" ||
  currentUser?.role === "PROJECT_MANAGER";
```

**Why this must move.** The server now holds a 60 value permission set and
`ROLE_PERMISSIONS` is its only source of truth. A client re-deriving capability
from a role string is a second, silently divergent copy of that map. When phase 4
moved `REVIEW_LEAVE_REQUEST` from PROJECT_MANAGER to ADMIN only, nothing in the
frontend noticed.

**Where it goes.** Two mechanisms, and both are needed:

1. **`GET /users/me/permissions`** already exists and returns the caller's
   effective set. `RoleContext` feeds `can()` and `canAny()` from it. This
   answers "may this role ever do this".
2. **Per resource capability flags** on the response: `canEdit`, `canArchive`,
   `canApprove`, `canDelete`. This answers "may this caller do it to THIS
   project", which a permission alone cannot, because it depends on
   `ProjectMember` rows.

Roughly two thirds of the 39 are case 1. The rest, anything named
`canManageThisProject`, `canEditPlan`, `canEditWrapUp`, `canAdministerProject`,
need case 2 because they encode project scope or an edit window.

**Note the sharpest one.** `canEditWrapUp` re-implements the two hour edit window
client side. The server owns that rule and the clocks can disagree.

---

## Category 2: display labels and tones. Move

```ts
function getStatusTone(status: ProjectStatus) {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "ON_HOLD" || status === "WAITING_FOR_FEEDBACK")
    return "warning";
  if (status === "IN_PROGRESS" || status === "READY_FOR_WORK") return "primary";
  return "default";
}
```

That is a business judgment about severity, not a styling choice: it decides that
waiting on a client is a warning and that being on hold is equally bad. It sits
next to `getPriorityTone` and five copies of `formatEnumLabel`, which turns
`READY_FOR_WORK` into "Ready For Work" by string manipulation, giving "Ai" for
`AI_SUMMARY` and no way to say "Ready for work" with a lowercase w.

**Where it goes.** A status arrives as an object:

```json
{ "value": "READY_FOR_WORK", "label": "Ready for work", "tone": "primary" }
```

The tone vocabulary is a small closed set (`default`, `primary`, `success`,
`warning`, `danger`). The client's only remaining job is mapping a tone name to a
CSS class, which is presentation.

Applies to `ProjectStatus`, `ProjectPriority`, `BlockerStatus`, `BlockerSeverity`,
`LeaveStatus`, `DailyWorkReportStatus`, `AdditionalRequirementStatus`,
`InternalReviewDecision`, `ClientFeedbackDecision`, `ProjectType`, `Role`.

---

## Category 3: sorting. Move

18 `.sort(` calls. Sorting client side is not only duplicated work, it is
**incorrect under pagination**: sorting the current page reorders 20 rows, not
the result set, so row 21 never appears where it belongs.

The backend already has the canonical comparator (`compareForDashboard`) and the
`ProjectsService` list endpoints apply it. Everywhere else, sorting becomes a
query parameter.

Worth checking case by case: a few of these sort a small fixed list that is not
paginated, for example project type checkboxes in a dialog. Those are
presentation and can stay.

---

## Category 4: aggregation and derived numbers. Move

16 occurrences: summed hours, counts of open blockers, compliance percentages,
"x of y complete" strings.

`GET /projects/:id/time-entries` already returns `totalMinutes` and `totalHours`
over the full filter rather than the page, which is the pattern. The rest should
follow it.

The test for each: **if a second API consumer would have to compute the same
number, it belongs in the response.**

---

## Category 5: date and number formatting. KEEP

11 `formatDate`, 11 `formatDateTime`, 6 `formatMinutes`, 3 `formatHours`.

These are locale presentation, not business rules, and D4 explicitly allows
`Intl`. The problem here is duplication, not location: the same function is
declared in eleven files.

**Action:** consolidate into `lib/format.ts`. Do NOT move to the backend. A
server that formats dates has to guess the viewer's locale and timezone, and will
guess wrong.

**One exception.** `formatMinutes` and `formatHours` sometimes round. Where a
rounded number is compared or summed downstream, the rounding is a business rule
and belongs server side. Check each of the nine.

---

## Proposed order

Each step is shippable and independently useful.

| Step | Work                                                                               | Why first                                                               |
| ---- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1    | `lib/format.ts`, consolidating the date and number helpers                         | Pure cleanup, no API change, removes 30 duplicate declarations          |
| 2    | Capability flags on responses, plus `RoleContext` from `GET /users/me/permissions` | The correctness risk: the client's permission copy is already divergent |
| 3    | `{ value, label, tone }` on every enum in a response                               | Unblocks deleting `formatEnumLabel` and both tone functions             |
| 4    | Sorting and filtering to query params                                              | Fixes the pagination correctness bug as a side effect                   |
| 5    | Aggregations into response fields                                                  | Largest volume, lowest risk                                             |
| 6    | The presentation only ESLint rule, as `warn` then `error`                          | Only meaningful once 1 to 5 have cleared the violations                 |

---

## Open questions for the owner

1. **Should `label` be server supplied at all?** It hardcodes English in the API.
   The alternative is the client owning a label map keyed on the enum, which is
   presentation but reintroduces a second source of truth for the vocabulary.
   Recommendation: server supplied, since this product is English only and the
   API already carries English copy in its error messages.
2. **How fine grained should capability flags be?** One `canEdit` per resource,
   or one flag per mutating endpoint. Finer is more honest and more payload.
   Recommendation: per resource, adding a specific flag only where the UI
   genuinely gates that action separately.
3. **`formatMinutes` rounding.** Nine call sites. Worth deciding once whether
   rounded durations are a display concern or a reported number.
