# Roles & Permissions — Single Source of Truth

**Status**: Documents the system *as implemented* on branch `feature/4-project-crud`, verified against the actual controllers/services (not the original spec docs, which drift from the code — see `pixelvega-build-spec.md`).
**Last verified**: 2026-07-26

This is a reference for "who can do what" across every module. It intentionally spends most of its depth on **PROJECT_MANAGER, DEVELOPER, and DESIGNER**, since `SYSTEM_ADMIN`/`ADMIN` can do almost everything and `CLIENT` has a small, mostly read-only surface.

**How to use this file**: §2–4 are the fast path — role-by-role Can/Cannot, a module-level overview, and a condensed action-by-action matrix. §5–7 cover workflows, known inconsistencies, and project ordering. §8 is the exhaustive route-by-route appendix — the ground truth to check when a §2–4 summary isn't precise enough.

---

## 1. How to read this document

- Every route is gated by a `@Roles([...])` decorator. **`SYSTEM_ADMIN` and `ADMIN` are automatically added to every role list** by the app's `Roles()` wrapper (`src/common/decorators/roles.decorator.ts`) — so wherever this doc says "PROJECT_MANAGER", read it as "PROJECT_MANAGER **+ ADMIN + SYSTEM_ADMIN**" unless a note says otherwise.
- A route decorator is only the *first* gate. Many services add a **second, finer-grained check** that a decorator can't express (e.g. "must be staffed on this specific project"). Where that exists, it's called out explicitly — this is the difference between "PROJECT_MANAGER can do X" and "*only a PM staffed on that project* can do X."
- Scope vocabulary used throughout:

  | Tier | Meaning |
  |---|---|
  | **Company-wide** | Any user holding that role can act, regardless of whether they're staffed on the project in question |
  | **Project-scoped** | Caller must have an active `ProjectMember` row (`leftAt: null`) on *that specific project*, in any staff role (PM/Developer/Designer) |
  | **PM-of-project** | Caller must have an active `ProjectMember` row on *that specific project* with role `PROJECT_MANAGER` specifically — narrower than the row above |
  | **Own-only (absolute)** | Only the record's owner, and this is **not** overridable by ADMIN/SYSTEM_ADMIN — a hard ownership check, not a role check |
  | **No access** | No route exists, or the role is explicitly excluded |

---

## 2. Role snapshots — Can / Cannot

### SYSTEM_ADMIN
The single root account, bootstrapped automatically the moment the `User` table is empty (`SystemAdminBootstrapService`). Identical to ADMIN across every project, staffing, time-tracking, and blocker action — the only place it's special is user management itself.

- **Can, beyond ADMIN**: edit, suspend, or delete another `ADMIN` account · invite a new `ADMIN` · change any user's role across the ADMIN boundary.
- **Still cannot**: change their own role · be deleted, or have a second `SYSTEM_ADMIN` created — both are permanently blocked by the API.

### ADMIN
Full company-wide access to every project-domain module — the same footprint as a Project Manager, without any of the "must be staffed on this project" narrowing that occasionally applies to a plain PM (see §4).

- **Can**: create, edit, cancel, and archive any project · staff any project; manage documents, requirements, blockers, and daily reports company-wide · approve or reject leave requests · invite and manage any non-`ADMIN` user; view the audit log.
- **Cannot**: edit, delete, or change the role of another `ADMIN`, or of `SYSTEM_ADMIN` · invite a new `ADMIN` (only `SYSTEM_ADMIN` can) · change their own role.

### PROJECT_MANAGER
The rule is simple and applied consistently: **reads stay company-wide, writes require being actively staffed as PM on that specific project.** A PM can *see* any project, its documents, requirements, members, and blockers regardless of staffing — but to *change* any of it, they need an active `PROJECT_MANAGER`-role `ProjectMember` row on that exact project (`assertManagesProject`, checked in the service layer, not just the route decorator).

- **Can (company-wide, any project)**: view all projects, a project's activity timeline, team roster, documents, additional requirements, and blockers · view pending/approved leave and balances · create a new project (see bootstrapping note below) · report a blocker on any project.
- **Can (only on projects staffed as PM)**: edit a project's details/priority/estimated-hours/types/status, archive it · staff or unstaff team members · upload, edit, or delete documents · log or approve/reject an additional requirement · resolve someone else's blocker · review a daily-report entry.
- **Cannot**: run a timer themselves (time tracking is Developer/Designer only) · approve or reject leave (view-only) · cancel a project (`ADMIN`/`SYSTEM_ADMIN` only, regardless of staffing) · invite or manage user accounts, or view the audit log.

**Bootstrapping a new project**: `POST /projects` auto-staffs the creating PM as an active `PROJECT_MANAGER` `ProjectMember` on their own new project the moment it's created — otherwise they'd be immediately locked out of editing something they just made. `ADMIN`/`SYSTEM_ADMIN` creators are *not* auto-staffed (they don't need it, and they don't hold the `PROJECT_MANAGER` global role a staffing row requires). A **second** PM can only be added to a project by `ADMIN`/`SYSTEM_ADMIN`, or by a PM already staffed on it — there's no self-service way for an unstaffed PM to add themselves.

**Visibility**: `GET /projects` gives a PM the full company-wide project list (with no flag distinguishing which ones they can actually edit vs. only view). `GET /projects/mine` gives *only* the projects they're actively staffed on, sorted by dashboard order (see §7). These are two separate endpoints, never merged — see §7.

### DEVELOPER
No visibility into a project until actively staffed on it — there's no read-only browse of projects they're not on. Once staffed, access to that project's documents, requirements, time entries, and daily reports is full **team** visibility, not limited to their own work.

- **Can**: see the whole team's time entries, documents, and requirements on staffed projects · track their own time; submit their own daily plan & wrap-up · change the status of a project they're staffed on (any staff role — not PM-of-project-scoped, just active membership) · report a blocker on **any** project, even ones they aren't staffed on · edit or resolve a blocker they personally reported, on any project · request and cancel their own leave.
- **Cannot**: see or act on a project they aren't staffed on, in any capacity · upload/edit documents, or approve requirements or leave · review anyone else's daily report entry · edit a project's priority/hours/types, staff/unstaff members, or archive a project (PM/ADMIN/SYSTEM_ADMIN only) · act on another person's timer, report, or blocker.

### DESIGNER
Every rule is identical to Developer — the two roles only differ in which `ProjectRole` staffing slot they can fill (a `ProjectMember` row's role must match the user's global `Role` 1:1; a `DEVELOPER` user can never be staffed as `DESIGNER`, and vice versa). Everywhere Developer's Can/Cannot applies above, it applies to Designer exactly the same way.

### CLIENT
The narrowest role by far — three surfaces, all scoped to their own account and their own projects, all read-mostly.

- **Can**: view their own projects, with a reduced field set (`CLIENT_PROJECT_SELECT`: no `priority`, `rushReason`, `onHoldReason`, `cancellationReason`, `createdBy`) · view `DELIVERABLE`-type documents on their own projects (any other type returns 404, not 403 — existence is hidden, not just access) · manage their own account and profile.
- **Cannot**: see any other project, even read-only · see internal documents, requirements, activity, staffing, time tracking, or daily reports on any project · appear as an actor anywhere else in the system (no staffing, no time tracking, no additional requirements, no daily reports, no blockers, no audit log).

---

## 3. Module access at a glance

✅ = has some access (see §2/§4 for exact scope) · — = no access at all. Note: a PM's ✅ on a *write* module (Projects CRUD, Staffing, Documents, Additional Requirements) means "only on projects staffed as PM," not company-wide — see §2/§4 for the read/write split.

| Module | SYSTEM_ADMIN / ADMIN | PROJECT_MANAGER | DEVELOPER | DESIGNER | CLIENT |
|---|:---:|:---:|:---:|:---:|:---:|
| Users (invite/manage accounts) | ✅ | read-only | — | — | — |
| Profiles | ✅ | ✅ (own + view others) | ✅ (own only) | ✅ (own only) | ✅ (own only) |
| Projects (CRUD, status, priority, types) | ✅ | ✅ | — | — | — |
| Projects (view) | ✅ (all) | ✅ (all) | ✅ (staffed only) | ✅ (staffed only) | ✅ (own only, reduced fields) |
| Project Members (staffing) | ✅ | ✅ | read-only (staffed projects) | read-only (staffed projects) | — |
| Project Documents | ✅ | ✅ | read-only (staffed projects) | read-only (staffed projects) | read-only (DELIVERABLE only, own project) |
| Time Tracking | ✅ (view only, can't run a timer) | view team hours (staffed projects) | ✅ (own timer + view team) | ✅ (own timer + view team) | — |
| Additional Requirements | ✅ | ✅ | read-only (staffed projects) | read-only (staffed projects) | — |
| Daily Work Reports | ✅ (review + view all) | review + view (staffed projects for review) | ✅ (own reports) | ✅ (own reports) | — |
| Blockers | ✅ | ✅ | report + edit own (any project) | report + edit own (any project) | — |
| Leave Types / Holidays (reference data) | ✅ (write) | read-only | read-only | read-only | read-only |
| Leave Requests | ✅ (approve/reject/view all) | view pending+approved, view balances | ✅ (own only) | ✅ (own only) | — |
| Audit Log | ✅ | — | — | — | — |

---

## 4. Quick-reference action matrix

Every differentiating action, grouped by module. Self-service basics — viewing or editing your own account/profile — aren't shown, since every role can already do those. `ADMIN` below stands for `ADMIN`/`SYSTEM_ADMIN` combined; they only diverge on the user-management rows, noted inline. Tier values: **Wide** = company-wide, **Project** = project-scoped, **PM** = PM-of-project (staffed as PM on that specific project), **Own** = own-only (absolute), **—** = no access.

| Module | Action | Admin | Project Mgr | Developer | Designer | Client |
|---|---|:---:|:---:|:---:|:---:|:---:|
| Users & accounts | Invite a new user | Wide¹ | — | — | — | — |
| Users & accounts | List or view any user account | Wide | Wide | — | — | — |
| Users & accounts | Edit, suspend, or delete a user | Wide¹ | — | — | — | — |
| Users & accounts | View another user's profile | Wide | Wide | — | — | — |
| Users & accounts | View the audit log | Wide | — | — | — | — |
| Leave | Submit a leave request | Own | Own | Own | Own | — |
| Leave | View pending / approved requests | Wide | Wide | — | — | — |
| Leave | Approve or reject a leave request | Wide | —² | — | — | — |
| Leave | Cancel own leave request | Own | Own | Own | Own | — |
| Projects | Create a project | Wide | Wide³ | — | — | — |
| Projects | View all projects (company-wide) | Wide | Wide | — | — | — |
| Projects | View assigned / own projects | Wide | Project | Project | Project | Own |
| Projects | View project activity timeline | Wide | Wide | Project | Project | — |
| Projects | Edit details, priority, hours, or types | Wide | PM | — | — | — |
| Projects | Change project status | Wide | PM | Project | Project | — |
| Projects | Cancel a project | Wide | — | — | — | — |
| Projects | Archive a project | Wide | PM | — | — | — |
| Staffing | View project team roster | Wide | Wide | Project | Project | — |
| Staffing | Add or remove a project member | Wide | PM | — | — | — |
| Documents | View project documents | Wide | Wide | Project | Project | Own⁴ |
| Documents | Upload, edit, or delete a document | Wide | PM | — | — | — |
| Time tracking | Run own timer (start/pause/resume/stop) | Own | — | Own | Own | — |
| Time tracking | View a project team's time entries | Wide | Project | Project | Project | — |
| Additional requirements | Log a new requirement | Wide | PM | — | — | — |
| Additional requirements | View requirements | Wide | Wide | Project | Project | — |
| Additional requirements | Approve or reject a requirement | Wide | PM | — | — | — |
| Daily reports | Submit / edit own plan & wrap-up | Own | — | Own | Own | — |
| Daily reports | View a project's daily reports | Wide | Wide | Project | Project | — |
| Daily reports | Review a daily report entry | Wide | PM | — | — | — |
| Blockers | Report a blocker (any project) | Wide | Wide | Wide | Wide | — |
| Blockers | Edit or resolve a blocker | Wide | PM⁵ | Own | Own | — |
| Blockers | View blockers (company-wide) | Wide | Wide | — | — | — |
| Blockers | View blockers (project dashboard) | Wide | Wide | — | — | — |

¹ Inviting/editing/deleting an `ADMIN` specifically requires `SYSTEM_ADMIN` — see §2.
² A PM can *see* pending/approved requests (row above) but can never approve or reject — see §5 #1.
³ The creating PM is automatically staffed as PM on the project they just created — see the bootstrapping note in §2. A second PM must be added by an ADMIN/SYSTEM_ADMIN or by a PM already staffed on it.
⁴ Own project only, and `DELIVERABLE`-type documents only.
⁵ Or the reporter themselves, regardless of staffing — see §6.

---

## 5. Known inconsistencies & edge cases

Real gaps/inconsistencies in the current implementation, not intentional design choices documented anywhere else — worth a product decision if any of these matter. (As of 2026-07-26, the three write-scoping inconsistencies that used to live here — project status transitions, the two blocker list endpoints, and daily-report-review vs. additional-requirement-review using different gates — have all been resolved: every PM mutation now consistently requires being staffed as PM on that project, and every blocker/project *view* is consistently company-wide. See §2 and §4.)

1. **A PM can see pending/approved leave requests but can never approve or reject one** — approval is `ADMIN`/`SYSTEM_ADMIN` only. If a PM is meant to manage their own team's leave, this isn't wired up.
2. **No cross-referencing between leave visibility and project staffing** — `LeaveRequestsService.findAll()` for a PM shows every pending/approved request company-wide, not scoped to developers the PM actually manages.
3. **Role-transition gap**: changing a user's `role` across the CLIENT ↔ staff boundary via `PATCH /users/:id` does not migrate/create the matching profile row, and doesn't touch any existing `ProjectMember` rows either — a user moved across that boundary can end up in an inconsistent state.
4. **`GET /profiles/:userId`** is `ADMIN`/`PROJECT_MANAGER` only, with no reduced shape or scoping — a PM can view *any* user's profile (including another PM's or a CLIENT's), not just people on their projects.
5. **`GET /leave-requests/:userId/balance`** is `ADMIN`/`PROJECT_MANAGER`-only with no target-user restriction — a PM can view any employee's leave balance, not just people they manage (there's no "people they manage" concept anywhere in this codebase).

---

## 6. Workflows & approvals

| Workflow | Who can trigger | Who can approve/finalize | Notes |
|---|---|---|---|
| Invite a new user | ADMIN | — | Only SYSTEM_ADMIN can invite a new ADMIN |
| Leave request | ADMIN/PM/DEVELOPER/DESIGNER (self) | **ADMIN only** | Created `PENDING` regardless of remaining balance; balance is only checked/decremented on approval. PM can see it in the pending/approved list but cannot act on it. |
| Additional Requirement | PM-of-project | **PM-of-project** (or ADMIN/SYSTEM_ADMIN) | One-shot review — `PATCH .../review` 409s if already reviewed. Approving is additive onto `estimatedHours`/`deadline`, never an override. |
| Daily Work Report entry review | PM/DEVELOPER/DESIGNER submit; PM reviews | **PM-of-that-project only** (or ADMIN/SYSTEM_ADMIN) | Can only review once the report's wrap-up is `COMPLETED`. Reviewing is per-entry, not per-report. |
| Blocker resolution | Reporter or PM-of-project | Reporter or PM-of-project (or ADMIN/SYSTEM_ADMIN) | `resolutionNotes` required to resolve. Once `RESOLVED`, locked for everyone, permanently — no override exists, even for SYSTEM_ADMIN. |
| Project status change | PM-of-project, or an active Developer/Designer member (any staff role) | — (no separate approval step) | `CANCELLED` requires ADMIN/SYSTEM_ADMIN specifically. `ON_HOLD`/`CANCELLED` require a `reason`. |
| Project archive | PM-of-project | — | Only `COMPLETED`/`CANCELLED` projects can be archived. |

---

## 7. Project ordering & "assigned vs. all" visibility — current state

There is currently **no unified, ordered list that shows "my projects first, then everything else I can see"** — the two views are separate endpoints with different scoping and no shared ordering:

- **`GET /projects/mine`** (PM/DEVELOPER/DESIGNER/CLIENT) — scoped to *only* projects the caller is staffed on (or is the client of). Sorted by `compareForDashboard()`: active status (`READY_FOR_WORK`/`IN_PROGRESS`) first, then `Priority`, then `Deadline`, then `Planned Start Date`. This ordering is **only** applied here.
- **`GET /projects`** (PM/ADMIN/SYSTEM_ADMIN only) — the full company-wide list, filterable by status/priority/clientId/projectTypes, but with **no special ordering** (default Prisma order) and **no "staffed on this" flag** to let a frontend visually separate "mine" from "everyone else's" within the same list.

Practically: a Developer/Designer never sees "everything else" at all (no route returns unstaffed projects to them), so for those two roles the open question doesn't apply — their only list *is* "assigned projects." For a PM, the two lists exist but are never merged; a PM-facing UI that wants "my projects pinned to the top of the full list" would need to fetch both endpoints and merge/sort client-side today, since the backend doesn't do it. **This is a gap to flag if that unified ordering becomes a real requirement** — it would most naturally be a new field on the `GET /projects` response (e.g. `isStaffedByCaller: boolean`) plus a documented sort order, rather than a third endpoint.

---

## 8. Full module reference (routes, roles, scoping)

### Users
| Route | Roles | Extra scoping |
|---|---|---|
| `POST /users/invite` | ADMIN | Can't invite an ADMIN unless actor is SYSTEM_ADMIN |
| `GET /users/me` | any authenticated role | self-only |
| `PATCH /users/me/password` | any authenticated role | self-only |
| `GET /users` | ADMIN, PROJECT_MANAGER | company-wide, no scoping |
| `GET /users/:id` | ADMIN, PROJECT_MANAGER | company-wide, no scoping |
| `PATCH /users/:id` | ADMIN | can't touch SYSTEM_ADMIN; can't touch another ADMIN unless actor is SYSTEM_ADMIN; can't change own role; can't promote to ADMIN unless SYSTEM_ADMIN |
| `DELETE /users/:id` | ADMIN | SYSTEM_ADMIN can never be deleted; ADMIN target requires actor = SYSTEM_ADMIN |

### Profiles
| Route | Roles | Extra scoping |
|---|---|---|
| `GET/PATCH /profiles/me`, `POST /profiles/me/avatar` | any authenticated role | self-only |
| `GET /profiles/:userId` | ADMIN, PROJECT_MANAGER | company-wide, no scoping |

### Leave Types / Holidays (reference data)
| Route | Roles | Extra scoping |
|---|---|---|
| `GET /leave-types`, `GET /holidays` | any authenticated role | none |
| `POST/PATCH/DELETE /leave-types`, `/holidays` | ADMIN | none |

### Leave Requests
| Route | Roles | Extra scoping |
|---|---|---|
| `POST /leave-requests` | ADMIN, PROJECT_MANAGER, DEVELOPER, DESIGNER | self-only; always `PENDING` |
| `GET /leave-requests/me`, `/me/balance` | ADMIN, PROJECT_MANAGER, DEVELOPER, DESIGNER | self-only |
| `GET /leave-requests/:userId/balance` | ADMIN, PROJECT_MANAGER | company-wide |
| `PATCH /leave-requests/:id/cancel` | ADMIN, PROJECT_MANAGER, DEVELOPER, DESIGNER | **own-only (absolute)**, must be `PENDING` |
| `GET /leave-requests` | ADMIN, PROJECT_MANAGER | ADMIN sees all statuses; PM sees only PENDING/APPROVED |
| `PATCH /leave-requests/:id/approve`, `/reject` | ADMIN only | must be `PENDING` |

### Projects
| Route | Roles | Extra scoping |
|---|---|---|
| `POST /projects` | PROJECT_MANAGER | `clientId` must be an existing CLIENT user; a PM caller is auto-staffed as PM on the new project (ADMIN/SYSTEM_ADMIN are not) |
| `GET /projects` | PROJECT_MANAGER | company-wide |
| `GET /projects/mine` | PROJECT_MANAGER, DEVELOPER, DESIGNER, CLIENT | staffed-only (staff roles) / own-client-only (CLIENT), reduced fields for CLIENT |
| `GET /projects/users/:userId` | PROJECT_MANAGER | same staffed-only scoping, for an arbitrary target user |
| `GET /projects/:id` | PROJECT_MANAGER, DEVELOPER, DESIGNER, CLIENT | company-wide (PM); project-scoped (DEV/DESIGNER); own-only + reduced fields (CLIENT) |
| `GET /projects/:id/activities` | PROJECT_MANAGER, DEVELOPER, DESIGNER | company-wide (PM); project-scoped (DEV/DESIGNER); **no CLIENT access** |
| `PATCH /projects/:id`, `/priority`, `/estimated-hours`, `/types`, `/archive` | PROJECT_MANAGER | **PM-of-project-scoped** (`assertManagesProject`) |
| `PATCH /projects/:id/status` | PROJECT_MANAGER, DEVELOPER, DESIGNER | PM-of-project (PM); project-scoped, any staff role (DEV/DESIGNER); → `CANCELLED` requires ADMIN/SYSTEM_ADMIN |

### Project Members (staffing)
| Route | Roles | Extra scoping |
|---|---|---|
| `GET /projects/:projectId/members` | PROJECT_MANAGER, DEVELOPER, DESIGNER | company-wide (PM); project-scoped (DEV/DESIGNER) |
| `POST/DELETE /projects/:projectId/members[/:id]` | PROJECT_MANAGER | **PM-of-project-scoped** |

### Project Documents
| Route | Roles | Extra scoping |
|---|---|---|
| `GET /projects/:projectId/documents[/:id]` | PROJECT_MANAGER, DEVELOPER, DESIGNER, CLIENT | company-wide (PM); project-scoped (DEV/DESIGNER); own-project + DELIVERABLE-only (CLIENT) |
| `POST/PATCH/DELETE .../documents` (incl. batch) | PROJECT_MANAGER | **PM-of-project-scoped** |

### Time Tracking
| Route | Roles | Extra scoping |
|---|---|---|
| `GET /projects/:projectId/time-entries[/daily-summary]` | PROJECT_MANAGER, DEVELOPER, DESIGNER | project-scoped for all three; once in, sees the whole team's entries |
| `POST/PATCH .../time-entries/*` (start/pause/resume/stop) | DEVELOPER, DESIGNER | project-scoped to start; **own-only (absolute)** for pause/resume/stop |
| `GET /time-entries/active`, `/project-summary` | PROJECT_MANAGER, DEVELOPER, DESIGNER | self-only for DEV/DESIGNER; any user for PM |

### Additional Requirements
| Route | Roles | Extra scoping |
|---|---|---|
| `GET /projects/:projectId/additional-requirements[/:id]` | PROJECT_MANAGER, DEVELOPER, DESIGNER | company-wide (PM); project-scoped (DEV/DESIGNER); **no CLIENT access** |
| `POST .../additional-requirements`, `PATCH .../:id/review` | PROJECT_MANAGER | **PM-of-project-scoped**; review is one-shot only |

### Daily Work Reports
| Route | Roles | Extra scoping |
|---|---|---|
| `POST /daily-work-reports`, `PATCH .../plan`, `GET .../today` | DEVELOPER, DESIGNER | own-only (absolute); project-scoped per listed project |
| `GET /daily-work-reports` | DEVELOPER, DESIGNER, PROJECT_MANAGER | self-only (DEV/DESIGNER); any user (PM) |
| `POST/PATCH .../wrap-up` | DEVELOPER, DESIGNER | own-only (absolute) |
| `PATCH .../entries/:id/review` | PROJECT_MANAGER | **PM-of-project-scoped** |
| `GET /projects/:projectId/daily-work-reports` | PROJECT_MANAGER, DEVELOPER, DESIGNER | company-wide (PM); project-scoped (DEV/DESIGNER); **no CLIENT access** |

### Blockers
| Route | Roles | Extra scoping |
|---|---|---|
| `POST /blockers` | DEVELOPER, DESIGNER, PROJECT_MANAGER | **no membership check** — any project |
| `PATCH /blockers/:id` | DEVELOPER, DESIGNER, PROJECT_MANAGER | reporter (own-only) **or** PM-of-project; locked once `RESOLVED` |
| `GET /blockers` | PROJECT_MANAGER | company-wide |
| `GET /projects/:projectId/blockers` | PROJECT_MANAGER | company-wide — same scoping as `GET /blockers` above |

### Audit Log
| Route | Roles | Extra scoping |
|---|---|---|
| `GET /audit-logs` | ADMIN | company-wide |

---

## Maintaining this document

This file lives in `docs/` (gitignored, local-only — same as `CLAUDE.md`/`pixelvega-build-spec.md`), so it won't survive a fresh clone on its own. Whenever a route's `@Roles()` list or a service's scoping check changes, update the relevant table above in the same session — this doc is only useful if it stays truthful to the code, not the original spec.
