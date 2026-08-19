Project Module
Project Creation & Staffing
A project is created by an Admin, System Admin, or Project Manager.
A project is tagged with one or more Project Types, for example, a WordPress project that also includes SEO work.
A project starts in Planning status with no team assigned.
A project stays in Planning until a Project Manager and at least one Developer or Designer are assigned.
A Project Manager checks availability status before assigning a Developer or Designer to a project.
A project with a future planned start date moves to Scheduled.
If the planned start date is today or has already passed, the project moves directly to Ready For Work.
When the planned start date of a Scheduled project arrives, the system moves it to Ready For Work.
A Developer or Designer moves the project from Ready For Work to In Progress when work begins.
Project Status
A project status is one of Planning, Scheduled, Ready For Work, In Progress, On Hold, Internal Review, Ready For Client, Waiting For Feedback, Completed, or Cancelled.
A project moves to On Hold with a required reason.
A project moves back to Ready For Work when work resumes from On Hold.
When a Developer or Designer begins working again, the project moves from Ready For Work to In Progress.
A project moves to Cancelled from any pre-completion status, restricted to Admin and System Admin, with a required reason.
Archiving a project is independent of its status, a Completed project and a Cancelled project can both be archived.
Removing all Developers or Designers from a project does not change its status. The project remains in its current status until new team members are assigned.
Project Priority
Every project has a priority of Low, Medium, High, Urgent, or Critical.
The default priority is Medium.
Only an Admin, System Admin, or Project Manager can change a project's priority. [Beyond spec: a Project Manager must additionally be actively staffed as PM on this specific project — not just hold the role company-wide. Admin/System Admin are unrestricted. Same rule now applies to editing project details/estimated-hours/types, archiving, staffing add/remove, document writes, and additional-requirement create/approve — see the Project Team and Documents & Credentials sections below.]
Changing a project's priority creates a ProjectActivity entry.
A rushReason may be required when setting a project's priority to Urgent or Critical.
Project Activity
Every significant project event creates a ProjectActivity record.
Project activities provide a chronological timeline of the project's history.
Activities include project creation, status changes, team changes, document updates, standup submissions, wrap ups, client feedback, deadline changes, priority changes, project completion, cancellation, and archival.
Project activities are immutable and serve as the project's historical record.
Internal Review [IMPLEMENTED]
Note: ProjectInternalReview now exists (InternalReviewsService/InternalReviewsController, nested under projects/:projectId/internal-reviews) recording the reviewer/round/decision/comments below, and PATCH /projects/:id/status no longer allows INTERNAL_REVIEW -> READY_FOR_CLIENT/READY_FOR_WORK generically. Those two transitions only happen through POST .../internal-reviews now.
A Developer or Designer moves a project to Internal Review once their assigned work is complete and ready for review. [IMPLEMENTED, unchanged, via the generic status endpoint]
A Project Manager reviews the submitted work before it is shared with the Client. [IMPLEMENTED, POST /projects/:projectId/internal-reviews, PROJECT_MANAGER staffed on this project (+auto Admin/System Admin)]
Every internal review creates a ProjectInternalReview record, preserving the complete review history, including the reviewer, review round, decision, comments, and review date. [IMPLEMENTED]
If the internal review passes, the Project Manager moves the project to Ready For Client. [IMPLEMENTED, decision: APPROVED]
If the internal review requires revisions, the Project Manager moves the project to Ready For Work. [IMPLEMENTED, decision: CHANGES_REQUIRED, comments required]
A project remains in Ready For Work until a Developer or Designer resumes work. [IMPLEMENTED, unchanged]
When a Developer or Designer begins working on the requested revisions, the project moves from Ready For Work to In Progress. [IMPLEMENTED, unchanged]

Client Review [NOT YET BUILT]

Note: WAITING_FOR_FEEDBACK -> COMPLETED is likewise already reachable via PATCH /projects/:id/status, but no ClientFeedback model exists to record the decision/comments/round below, and there's no dedicated client-facing feedback-submission endpoint.

A Client can view only the status of their own projects and documents marked as Deliverable.
A Client submits feedback by selecting either Approved or Changes Requested directly within the system.
Every client response is stored as a new ClientFeedback record, preserving the complete feedback history and never overwriting previous rounds.
When feedback is received outside the system, such as by email, phone call, or a marketplace platform, a Project Manager records the Client's response on the Client's behalf.
Each ClientFeedback record stores both the Client who provided the feedback and, when applicable, the Project Manager who recorded it.
An Approved response moves the project to Completed.
A Changes Requested response moves the project to Ready For Work, indicating that additional work is required.
A project remains in Ready For Work until a Developer or Designer resumes work.
When a Developer or Designer begins working on the requested revisions, the project moves from Ready For Work to In Progress.
Project Team
A project can have more than one Project Manager, Developer, or Designer assigned at the same time.
Adding a team member always creates a new ProjectMember record. [Beyond spec: a Project Manager caller must already be actively staffed as PM on this specific project to add or remove anyone (Admin/System Admin can staff any project regardless). A brand-new project has no staff yet, so the Project Manager who creates it is automatically staffed as its first PM at creation time — otherwise they'd have no way to staff it themselves. A second PM can only be added by an Admin/System Admin or by a PM already staffed on that project.]
Removing a team member never deletes or updates previous membership records. Instead, the member leaves the project by setting leftAt, preserving the complete membership history.
If the same user joins the project again later, a new ProjectMember record is created. Previous membership records remain unchanged.
Only ProjectMember records where leftAt is NULL are considered active team members.
Every active team member has access to the project's complete history, including documents, standups, additional requirements, client feedback, and project activities.
Every team membership change, such as joining or leaving a project, creates a corresponding ProjectActivity entry, providing a chronological timeline of the project's history.
A new team member joining an existing project can view the full project timeline, including previous documents, standups, client feedback, additional requirements, and project activities, but cannot modify historical records.

Documents & Credentials

A project document is either typed text or an uploaded file.
A credential is stored as typed text, not as a file.
A file document records its type, its file size, and its file format.
Only an Admin, System Admin, or Project Manager uploads or types a project document. [Beyond spec: a Project Manager must be actively staffed as PM on this specific project — same rule as staffing/priority above. Reading documents stays company-wide for any Project Manager, only writes are staffing-scoped.]
A Client never uploads, types, or edits a project document.
A Client sees only Deliverable-type documents , a live website link, a Figma link, or similar.
A Client never sees a PRD, a Requirement, a Meeting Note, a Credential, or an internal Asset.
Time Tracking [IMPLEMENTED]
A Developer or Designer starts, pauses, resumes, and stops a timer to record work on a project; each pause/resume closes one segment and opens a new one under the same session, rather than mutating a single row in place.
The system prevents a Developer or Designer from starting another timer while an active (RUNNING) timer already exists — this is global per user, not per project.
A continuous RUNNING stretch is capped at 9 hours; if it's never touched, the next read or write that encounters it auto-stops it at the cap and discards time worked beyond that.
The system recalculates actual project hours whenever a segment ends — on pause and on stop, not only on a final stop, since a paused segment's elapsed time already counts. Remaining hours are derived on read (estimatedHours - actualHours), never stored.

Meeting Time Tracking [Beyond spec, IMPLEMENTED — see docs/features/time-meeting/DESIGN.md, gitignored]
Not in the original spec at all. Added because project and daily-summary hour totals looked short whenever someone spent real time in office meetings (standups, planning, client calls) that weren't billed to any project. A Developer, Designer, Project Manager, or Admin starts, pauses, resumes, and stops a MeetingTimeEntry timer, the same append-only segment shape as TimeEntry, but never attached to a project and never touching Project.actualHours. Only one timer of any kind (project or meeting) can run per person at once, enforced across both tables. GET /time-entries/daily-summary is the new cross-project, cross-meeting endpoint that shows projectMinutes next to meetingMinutes for each day, the number the spec's project/daily numbers were missing. Both TimeEntry and MeetingTimeEntry additionally gained a same-UTC-day completion rule as part of this work — a segment must be paused/resumed/stopped the same day it started, or it's locked (a RUNNING one is auto-finalized at that day's end, a PAUSED one is rejected with 409 on any further edit).
Daily Standup & Wrap-Up [IMPLEMENTED, under different names — see note]

Note: built as DailyWorkReport/DailyProjectEntry, not DailyStandup/StandupEntry — planForToday -> plan, wrapUpNotes -> accomplishments. Blockers are not a field on the entry (see the bullet below) — they're a fully independent, continuously-tracked entity (OPEN -> IN_PROGRESS -> RESOLVED, can span multiple days, no daily reset); see the "Real-Time Blockers" section below, and docs/features/daily-standups/DESIGN.md (gitignored) for the fuller design.

A Developer or Designer submits one standup per working day. [IMPLEMENTED — POST /daily-work-reports]
A standup consists of one entry for each project the user plans to work on that day. [IMPLEMENTED]
The user selects one or more projects and provides a plan and any blockers for each project in a single standup form. [PARTIALLY IMPLEMENTED — plan yes; blockers field removed from this model entirely, see note above]
The entire standup is submitted in one action, creating one DailyStandup record and one StandupEntry record for each selected project. [IMPLEMENTED, renamed — one DailyWorkReport + one DailyProjectEntry per project]
After submission, the system posts the complete standup to the shared team standup Slack channel. [IMPLEMENTED — one combined message per report per person per day, covering every project touched that day, posted to SLACK_DAILY_FEED_CHANNEL_ID; edited in place (not re-posted) on any later plan update, always rebuilt from the report's full current entry set rather than just the ones in that particular update]
The system also posts each project's individual standup entry to that project's dedicated Slack channel, using only that project's plan and blockers. [IMPLEMENTED, minus blockers — one message per project entry to that project's own Slack channel (Project.slackChannelId); no blockers text since blockers were redesigned out of the daily-entry model entirely, see note above. Silently no-ops if the project has no Slack channel connected.]
A Developer or Designer submits one wrap up per working day using the same projects selected for that day's standup. [IMPLEMENTED, with a deliberate relaxation — wrap-up may also include a project that was never in that day's plan (e.g. unplanned/urgent work); DailyWorkReportService.submitWrapUp() upserts rather than requiring the entry to pre-exist]
Each user can have only one DailyStandup record per calendar day. [IMPLEMENTED — @@unique([userId, date]) on DailyWorkReport]
The wrap up is submitted as a single action and updates the existing StandupEntry records for that day. [IMPLEMENTED, plus creates a new entry for any unplanned project — see above]
After submission, the system posts the complete wrap up to the shared team wrap up Slack channel. [IMPLEMENTED — same combined-per-report message as the standup above, posted to SLACK_DAILY_FEED_CHANNEL_ID]
The system also posts each project's individual wrap up entry to that project's dedicated Slack channel. [IMPLEMENTED — one message per project entry to its own Slack channel]
A Project Manager may review and comment only on the StandupEntry records belonging to projects they manage. [IMPLEMENTED — PATCH /daily-work-reports/:reportId/entries/:entryId/review, scoped to an active PROJECT_MANAGER member of that entry's specific project (or Admin/System Admin), and only once the report's wrap-up is COMPLETED (409 otherwise)]
A review applies only to the individual project entry and does not affect the user's other project entries. [IMPLEMENTED]
If a Developer or Designer has not submitted a standup for the current day, the system may send reminder notifications. [NOT YET BUILT — no notification system exists in this backend]

Beyond the original spec, also implemented:
The plan is editable anytime until wrap-up is submitted (no time limit, state-based lock); the wrap-up is editable for a fixed 2-hour window after submission (time-based lock), then locked for audit — two independent edit windows, not in the original spec.
Plan is mandatory before wrap-up — submitWrapUp() returns 409 if a plan was never submitted for that report.
GET /projects/:projectId/daily-work-reports — all of one project's entries across every developer and day, filterable by userId/date-range/type=PLAN|WRAP_UP.
GET /daily-work-reports — one user's reports across every project they've touched, self-service or (for PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN) any specific team member, filterable by date-range/type.

Real-Time Blockers [IMPLEMENTED, including Slack — see note]

Note: built as its own independent Blocker model (docs/features/daily-standups/DESIGN.md, gitignored, has the fuller design) — not tied to DailyWorkReport/DailyProjectEntry, not scoped to a calendar date, lives flat in the same ProjectsModule (BlockerService, BlockersController, ProjectBlockersController) rather than a separate module, for the same ProjectActivityService DI reason noted in CLAUDE.md's Module layout section.

A Developer, Designer, or Project Manager reports a blocker on any project, at any time. [IMPLEMENTED — POST /blockers, status defaults to OPEN, severity defaults to MEDIUM. Requires being an active member of the target project (any role); ADMIN/SYSTEM_ADMIN bypass this and can report on any project.]
A blocker's status moves through OPEN, IN_PROGRESS, and RESOLVED. [IMPLEMENTED — forward-only; IN_PROGRESS may be skipped (OPEN -> RESOLVED directly is allowed), but a move backward (e.g. IN_PROGRESS -> OPEN) is rejected.]
Only the person who reported a blocker, or a Project Manager staffed on that project (or Admin/System Admin), may edit or resolve it. [IMPLEMENTED — PATCH /blockers/:blockerId]
Resolving a blocker requires resolution notes. [IMPLEMENTED — 400 if resolutionNotes is missing when moving to RESOLVED, and 400 if resolutionNotes is sent without resolving]
Once a blocker is resolved, it is permanently locked — not even an Admin or System Admin can edit it further. [IMPLEMENTED — the one terminal-state lock in this module with no override at all]
A Project Manager (or Admin/System Admin) can view all blockers company-wide, or all blockers for one specific project. [IMPLEMENTED — GET /blockers and GET /projects/:projectId/blockers; company-wide for Project Manager/Admin/System Admin. A Developer/Designer can also call both routes but is scoped to projects they're actively staffed on.]
Resolution time and days-open are shown for each blocker. [IMPLEMENTED — derived on read from createdAt/resolvedAt, never stored, same convention as "days" on Holiday/LeaveRequest]
A real-time Slack alert is posted when a blocker is reported, and when it is resolved. [IMPLEMENTED — posts to the project's own Slack channel only (never a shared feed channel), on report and on every status change (not just resolution); each post is a brand-new message, never edited in place, since every status change is treated as its own event]

Additional Requirements [PARTIALLY IMPLEMENTED — see note]
An Admin, System Admin, or Project Manager uploads a requirement received outside the system. [IMPLEMENTED — a Project Manager must be actively staffed as PM on this specific project, same rule as staffing/priority/documents above; reading requirements stays company-wide for any Project Manager]
The AI system compares the new requirement against the original project requirements and flags it as in-scope or out-of-scope. [NOT YET BUILT — no AI provider wired into this backend; aiScopeAnalysis exists as a column but nothing populates it]
A Project Manager approves or rejects an out-of-scope requirement. [IMPLEMENTED, but not scope-conditional — every requirement requires an explicit PM approve/reject regardless of any scope flag, since the AI flag above doesn't exist yet. Same PM-of-project staffing requirement as logging one.]
An approved additional requirement may increase the project's estimated hours and extend its deadline. [IMPLEMENTED — both additive on top of the project's current values, applied in AdditionalRequirementsService.review()]
Client Feedback [NOT YET BUILT]
Each round of client feedback is assigned an incrementing feedbackRound number.
Developer/Designer Dashboard
A Developer or Designer sees only projects where they are an active ProjectMember.
Projects are ordered primarily by Priority, then by Deadline, and finally by Planned Start Date.
Projects in Ready For Work and In Progress appear before completed or inactive projects.

// ---------------------------------------------------------------------------
// Project management
// ---------------------------------------------------------------------------

enum ProjectStatus {
PLANNING
SCHEDULED
READY_FOR_WORK
IN_PROGRESS
ON_HOLD
INTERNAL_REVIEW
READY_FOR_CLIENT
WAITING_FOR_FEEDBACK
COMPLETED
CANCELLED
}

enum ProjectPriority {
LOW
MEDIUM
HIGH
URGENT
CRITICAL
}

enum ProjectRole {
PROJECT_MANAGER
DEVELOPER
DESIGNER
}

enum ProjectDocumentType {
PRD
REQUIREMENT
MEETING_NOTE
CREDENTIAL
ASSET
DELIVERABLE
}

enum ProjectType {
WORDPRESS
WEBFLOW
WIX
FRAMER
FIGMA
MERN_STACK
SEO
}

enum ProjectDocumentFormat {
TEXT // credentials, quick notes — typed directly, no file
FILE // pdf, docx, image, zip, etc.
}

enum TimeEntryStatus { // [IMPLEMENTED]
RUNNING
PAUSED
STOPPED
}

enum AdditionalRequirementStatus { // [IMPLEMENTED]
PENDING_REVIEW
APPROVED
REJECTED
}

enum BlockerStatus { // [IMPLEMENTED]
OPEN
IN_PROGRESS
RESOLVED
}

enum BlockerSeverity { // [IMPLEMENTED]
LOW
MEDIUM
HIGH
}

enum InternalReviewDecision { // [IMPLEMENTED]
APPROVED
CHANGES_REQUIRED
}

enum ClientFeedbackDecision { // [NOT YET BUILT]
APPROVED
CHANGES_REQUESTED
}

enum ProjectActivityType {
PROJECT_CREATED
PROJECT_DETAILS_UPDATED
STATUS_CHANGED
PRIORITY_CHANGED
MEMBER_JOINED
MEMBER_LEFT
DEADLINE_CHANGED
PROJECT_TYPES_CHANGED // [IMPLEMENTED]
DOCUMENT_ADDED
DOCUMENT_UPDATED
DOCUMENT_REMOVED
TIME_STARTED // [IMPLEMENTED]
TIME_PAUSED // [IMPLEMENTED]
TIME_RESUMED // [IMPLEMENTED]
TIME_STOPPED // [IMPLEMENTED]
TIME_AUTO_STOPPED // [IMPLEMENTED] — 9-hour continuous-session cap
ESTIMATED_HOURS_CHANGED // [IMPLEMENTED]
PLAN_SUBMITTED // [IMPLEMENTED] renamed from STANDUP_SUBMITTED
PLAN_UPDATED // [IMPLEMENTED] not in original spec — plan is editable pre-wrap-up
WRAP_UP_SUBMITTED // [IMPLEMENTED]
WRAP_UP_UPDATED // [IMPLEMENTED] not in original spec — wrap-up is editable within a 2h window
WORK_REPORT_REVIEWED // [IMPLEMENTED] not in original spec — PM review of a DailyProjectEntry
ADDITIONAL_REQUIREMENT_ADDED // [IMPLEMENTED]
ADDITIONAL_REQUIREMENT_REVIEWED // [IMPLEMENTED]
BLOCKER_ADDED // [IMPLEMENTED]
BLOCKER_STATUS_CHANGED // [IMPLEMENTED]
INTERNAL_FEEDBACK_RECEIVED // [IMPLEMENTED]
CLIENT_FEEDBACK_RECEIVED // [NOT YET BUILT]
PROJECT_COMPLETED
PROJECT_CANCELLED
PROJECT_ARCHIVED
}

enum DailyStandupStatus { // [IMPLEMENTED, renamed — DailyWorkReportStatus]
NOT_STARTED // -> DRAFT (unused in practice — create() always goes straight to PLAN_SUBMITTED)
STANDUP_SUBMITTED // -> PLAN_SUBMITTED
COMPLETED
}

model Project {
id String @id @default(uuid())
name String
description String?
status ProjectStatus @default(PLANNING)
progressPercentage Int @default(0) // [NOT YET BUILT] no such column on the real Project model

clientId String
client User @relation("ProjectClient", fields: [clientId], references: [id])
createdById String
createdBy User @relation("ProjectCreatedBy", fields: [createdById], references: [id])

estimatedHours Float? // [IMPLEMENTED] manually set by PM/Admin via PATCH /projects/:id/estimated-hours — AI estimation is future work, not built
actualHours Float @default(0) // [IMPLEMENTED] recalculated as sum(durationMinutes)/60 across ended TimeEntry segments, on both pause and stop
// remainingHours is NOT a stored column — [IMPLEMENTED] derived on every read as (estimatedHours - actualHours)

slackChannelId String? // [IMPLEMENTED]

// Scheduling — "assigned" and "actually started" are different moments
plannedStartDate DateTime?
actualStartedAt DateTime? // [NOT YET BUILT]
lastWorkedAt DateTime? // [NOT YET BUILT]
readyForClientAt DateTime? // [NOT YET BUILT], deliberately not added alongside ProjectInternalReview. Revisit once Client Review is built if a dedicated column turns out to be needed (see docs/features/internal-review/DESIGN.md §3)
deadline DateTime?
priority ProjectPriority @default(MEDIUM)
rushReason String? // required when priority is set to URGENT or CRITICAL — enforced in service layer
completedAt DateTime?

onHoldReason String?
cancellationReason String?

members ProjectMember[]
activities ProjectActivity[]
documents ProjectDocument[]
projectTypeTags ProjectTypeTag[]
timeEntries TimeEntry[]
dailyProjectEntries DailyProjectEntry[] // [IMPLEMENTED] renamed from standupEntries/StandupEntry
additionalRequirements AdditionalRequirement[]
internalReviews ProjectInternalReview[] // [IMPLEMENTED]
clientFeedback ClientFeedback[] // [NOT YET BUILT]
blockers Blocker[] // [IMPLEMENTED]

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
archivedAt DateTime? // independent of status — COMPLETED or CANCELLED can both be archived

@@index([status])
@@index([clientId])
@@index([priority])
}

// One row per membership stint. Adding a member always creates a new row;
// removing sets leftAt rather than deleting — full history survives, and a
// user rejoining later gets a brand new row, not a reactivated old one.
// Only rows with leftAt = NULL count as active.
model ProjectMember {
id String @id @default(uuid())
projectId String
project Project @relation(fields: [projectId], references: [id])
userId String
user User @relation(fields: [userId], references: [id])
role ProjectRole

joinedAt DateTime @default(now())
leftAt DateTime?

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@index([projectId])
@@index([userId])
@@index([role])
@@index([leftAt])
@@index([projectId, leftAt])
}

model ProjectTypeTag {
id String @id @default(uuid())
projectId String
project Project @relation(fields: [projectId], references: [id])
type ProjectType

createdAt DateTime @default(now())

@@unique([projectId, type]) // a project can't be tagged the same type twice
@@index([projectId])
@@index([type])
}

// Immutable, typed timeline — the project's historical record. Never
// updated or deleted once written. Distinct from the generic AuditLog,
// which covers identity/leave/system-level events instead.
model ProjectActivity {
id String @id @default(uuid())
projectId String
project Project @relation(fields: [projectId], references: [id])
userId String?
user User? @relation(fields: [userId], references: [id])

type ProjectActivityType

message String?
metadata Json?

createdAt DateTime @default(now())

@@index([projectId])
@@index([projectId, createdAt])
@@index([type])
@@index([userId])
}

// Only Admin, System Admin, or Project Manager ever create these.
// Client only ever reads DELIVERABLE-type rows — enforced in the service layer.
model ProjectDocument {
id String @id @default(uuid())
projectId String
project Project @relation(fields: [projectId], references: [id])
description String?
type ProjectDocumentType
format ProjectDocumentFormat @default(FILE)
title String

// FILE format
fileUrl String?
fileMimeType String? // "application/pdf", "image/png", "application/zip", etc.
fileSizeBytes Int?

// TEXT format — e.g. credentials, quick notes
textContent String?

uploadedById String
uploadedBy User @relation(fields: [uploadedById], references: [id])

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
deletedAt DateTime?

@@index([projectId])
}

// [IMPLEMENTED] One row per running/paused/stopped SEGMENT, not a whole
// session — pausing closes a segment (endedAt/durationMinutes set, status:
// PAUSED) rather than mutating it back into a startable state; resuming
// inserts a brand-new row carrying the same sessionId forward (the first
// segment's sessionId equals its own id). "Only one active timer per
// person" is enforced in the service layer as a global (not per-project)
// check for any row with status: RUNNING before creating a new one.
model TimeEntry {
id String @id @default(uuid())
projectId String
project Project @relation(fields: [projectId], references: [id])
userId String
user User @relation(fields: [userId], references: [id])
sessionId String // shared across all segments of one continuous start→stop session
status TimeEntryStatus @default(RUNNING)
notes String?
startedAt DateTime @default(now())
endedAt DateTime? // set when paused or stopped; null while RUNNING
durationMinutes Int? // this segment's own elapsed minutes; set once endedAt is set

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@index([projectId])
@@index([userId])
@@index([userId, status])
@@index([sessionId])
}

// [IMPLEMENTED, renamed from DailyStandup] One row per person, per day.
// Submitted as a single action covering every project they worked on that
// day — this row is the "form"; DailyProjectEntry rows below are its
// per-project sections. Plan is mandatory before wrap-up: submitWrapUp()
// throws 409 unless status is already PLAN_SUBMITTED. Plan is editable
// anytime until wrap-up is submitted (no time limit); wrap-up is editable
// for a fixed 2 hours after wrapUpSubmittedAt, then locked for audit.
model DailyWorkReport {
id String @id @default(uuid())
userId String
user User @relation("WorkReportAuthor", fields: [userId], references: [id])
date DateTime @db.Date
status DailyWorkReportStatus @default(PLAN_SUBMITTED)

planSubmittedAt DateTime?
wrapUpSubmittedAt DateTime?

planFeedSlackTs String? // [IMPLEMENTED] ts of the one combined plan message posted to SLACK_DAILY_FEED_CHANNEL_ID for this report — covers every project entry at once, not one message per project
wrapUpFeedSlackTs String? // [IMPLEMENTED] same, for the combined wrap-up message

entries DailyProjectEntry[]

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@unique([userId, date])
@@index([userId])
@@index([date])
}

// [IMPLEMENTED, renamed from StandupEntry — Slack integration is built (see
// planProjectSlackTs/wrapUpProjectSlackTs below and the combined feed ts on
// DailyWorkReport above), no blockers field, see the Daily Standup &
// Wrap-Up section above] One row per project within a day's report. A row
// can have only `plan` set
// (planned but not yet wrapped up), or both `plan` and `accomplishments`
// (wrapped up), or only `accomplishments` (a project added at wrap-up time
// that wasn't part of the morning plan — allowed, since only the report as
// a whole requires a plan first, not every individual project entry).
model DailyProjectEntry {
id String @id @default(uuid())
dailyWorkReportId String
dailyWorkReport DailyWorkReport @relation(fields: [dailyWorkReportId], references: [id])
projectId String
project Project @relation(fields: [projectId], references: [id])

plan String?
accomplishments String?

planProjectSlackTs String? // [IMPLEMENTED] ts of this entry's plan message in its own project's Slack channel
wrapUpProjectSlackTs String? // [IMPLEMENTED] ts of this entry's wrap-up message in its own project's Slack channel

reviewedById String?
reviewedBy User? @relation("ProjectEntryReviewer", fields: [reviewedById], references: [id])
reviewedAt DateTime?
reviewComment String?

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@unique([dailyWorkReportId, projectId])
@@index([projectId])
}

model AdditionalRequirement { // [IMPLEMENTED, except aiScopeAnalysis — reserved, never populated]
id String @id @default(uuid())
projectId String
project Project @relation(fields: [projectId], references: [id])
description String
sourceChannel String? // "email", "fiverr", "upwork", "direct" — free text
aiScopeAnalysis Json? // AI's in/out-of-scope reasoning
status AdditionalRequirementStatus @default(PENDING_REVIEW)

uploadedById String
uploadedBy User @relation("AdditionalReqUploader", fields: [uploadedById], references: [id])
reviewedById String?
reviewedBy User? @relation("AdditionalReqReviewer", fields: [reviewedById], references: [id])
reviewedAt DateTime?

// Both additive, applied on top of the project's current values when approved —
// never absolute overrides. See §9 for the exact application logic.
approvedAdditionalHours Float?
deadlineExtensionDays Int?

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@index([projectId])
}

// [IMPLEMENTED] Completely independent of DailyWorkReport/DailyProjectEntry —
// can be reported and resolved anytime, spans however many days it takes, not
// scoped to a calendar date. Once RESOLVED it's locked (read-only, no
// override for anyone) — the one terminal-state lock in this module with no
// exception. resolutionTime/daysOpen are derived on read from
// createdAt/resolvedAt, never stored, same convention as `days` on
// Holiday/LeaveRequest. Posts to the project's own Slack channel on report
// and on every status change — see the "Real-Time Blockers" business-rule
// section above. No ts is stored on this model; each post is a brand-new
// message, never edited in place.
model Blocker {
id String @id @default(uuid())
projectId String
project Project @relation(fields: [projectId], references: [id])

description String
status BlockerStatus @default(OPEN)
severity BlockerSeverity @default(MEDIUM)

reportedById String
reportedBy User @relation("BlockerReportedBy", fields: [reportedById], references: [id])

resolvedById String?
resolvedBy User? @relation("BlockerResolvedBy", fields: [resolvedById], references: [id])
resolvedAt DateTime?
resolutionNotes String?

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@index([projectId])
@@index([status])
@@index([severity])
@@index([createdAt])
}

// [IMPLEMENTED] Internal QA gate before a project ever reaches the client.
// Multiple rounds accumulate — never overwritten — exactly like ClientFeedback below.
model ProjectInternalReview {
id String @id @default(uuid())
projectId String
project Project @relation(fields: [projectId], references: [id])
reviewedById String
reviewedBy User @relation(fields: [reviewedById], references: [id])

decision InternalReviewDecision
comments String?
reviewRound Int

createdAt DateTime @default(now())

@@unique([projectId, reviewRound])
@@index([projectId])
}

// [NOT YET BUILT] A round of client review. Multiple rows accumulate across
// rounds of "changes requested" — never overwritten, so the full review
// history is just this table ordered by feedbackRound.
model ClientFeedback {
id String @id @default(uuid())
projectId String
project Project @relation(fields: [projectId], references: [id])
clientId String // whose feedback this is
client User @relation("ClientFeedbackOwner", fields: [clientId], references: [id])
recordedById String? // set only when a PM logs it on the client's behalf
recordedBy User? @relation("ClientFeedbackRecordedBy", fields: [recordedById], references: [id])
decision ClientFeedbackDecision
comments String?
feedbackRound Int
createdAt DateTime @default(now())

@@unique([projectId, feedbackRound])
@@index([projectId])
}
