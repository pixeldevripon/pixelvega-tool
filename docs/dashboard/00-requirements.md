# Dashboard v1: requirements inventory

Every requirement stated in the four product documents, in one list, with what the backend already
serves and what the frontend still has to build.

## Sources

The four documents live in [`../product/`](../product/README.md), kept verbatim.

| Doc                        | What it is                                                                   |
| -------------------------- | ---------------------------------------------------------------------------- |
| `features.md`              | What the tool does today, plus a named list of what it does not do yet       |
| `features1.md`             | Two earlier drafts of the same scope (Tab 1 v1 scope, Tab 2 capability list) |
| `Project Module.md`        | The binding business rules for the project domain, plus the Prisma schema    |
| `AI Integration Module.md` | The binding business rules for the three AI features, plus the Prisma schema |

Where two documents disagree, the conflict is listed in [Conflicts to resolve](#conflicts-to-resolve)
rather than silently decided.

## How to read the status columns

| Value     | Meaning                                                                     |
| --------- | --------------------------------------------------------------------------- |
| `ready`   | Serves the requirement today. Verified against the controllers and the DTOs |
| `partial` | Exists, but does not yet cover the whole requirement                        |
| `gap`     | Does not exist. Has to be built                                             |
| `n/a`     | Not that layer's concern                                                    |

**The headline.** The backend is far further along than `features.md` suggests. Of the 178
requirements below, the backend already serves 144 and one more partly. The work is overwhelmingly a
frontend build (75 gaps, 51 partial, 25 already done) plus 32 focused backend additions, of which the
per-role dashboard endpoints are the largest and the most urgent.

---

## A. Getting in

| #   | Requirement                                                | Source   | Backend | Frontend |
| --- | ---------------------------------------------------------- | -------- | ------- | -------- |
| A1  | Log in with email and password                             | features | ready   | ready    |
| A2  | Forgot password sends a code by email, user sets a new one | features | ready   | partial  |
| A3  | First login forces the person to set their own password    | features | ready   | ready    |
| A4  | First login forces the person to complete their profile    | features | ready   | ready    |
| A5  | Light and dark mode switch                                 | features | n/a     | ready    |

A2 is `partial` because `app/(auth)/` has `login` and `forgot-password` but no reset screen, so the
emailed link has nowhere to land.

## B. People

| #   | Requirement                                                                   | Source          | Backend | Frontend |
| --- | ----------------------------------------------------------------------------- | --------------- | ------- | -------- |
| B1  | An Admin invites a new person by email                                        | features        | ready   | ready    |
| B2  | Six roles: System Admin, Admin, PM, Developer, Designer, Client               | features        | ready   | ready    |
| B3  | Each role sees a different menu, built from permissions and not from the role | features, D2    | ready   | partial  |
| B4  | Anyone views and updates their own profile and photo                          | features        | ready   | ready    |
| B5  | An Admin opens any person's record and sees their details                     | features        | ready   | ready    |
| B6  | Work status: sick, casual, WFH, onsite                                        | features1 Tab 1 | ready   | gap      |
| B7  | Availability: ready or occupied                                               | features1 Tab 1 | ready   | gap      |
| B8  | See how many and which projects each developer is on                          | features1 Tab 1 | ready   | gap      |
| B9  | Admin can create, edit and delete accounts across all roles                   | features1 Tab 1 | ready   | ready    |

B3 is `partial` because `components/dashboard/nav.ts` is a hardcoded map from role to menu, which is
a second copy of the permission map living in a browser (D2). It has to be rebuilt as a
permission-filtered navigation tree.

## C. Creating a project

| #   | Requirement                                                       | Source           | Backend | Frontend |
| --- | ----------------------------------------------------------------- | ---------------- | ------- | -------- |
| C1  | A PM, Admin or System Admin creates a project                     | features, PM doc | ready   | ready    |
| C2  | Name, client and at least one project type are required           | features         | ready   | ready    |
| C3  | Seven project types, and a project can carry more than one        | features         | ready   | ready    |
| C4  | Description, start date and deadline are optional at creation     | features         | ready   | ready    |
| C5  | A project starts in Planning with no team assigned                | PM doc           | ready   | ready    |
| C6  | An AI hours estimate is generated at project creation             | features1 Tab 1  | gap     | gap      |
| C7  | A PM checks availability before assigning a Developer or Designer | PM doc           | ready   | gap      |

## D. Running a project

| #   | Requirement                                                                       | Source    | Backend | Frontend |
| --- | --------------------------------------------------------------------------------- | --------- | ------- | -------- |
| D1  | A PM or Admin assigns developers and designers                                    | features  | ready   | partial  |
| D2  | Assigning someone already carrying a lot of work warns you                        | features  | ready   | gap      |
| D3  | A live readiness checklist: is a PM assigned, is a Developer or Designer assigned | features  | gap     | gap      |
| D4  | People who left are kept on the record and shown separately from the current team | features  | ready   | gap      |
| D5  | A PM or Admin sets priority, Low up to Critical, default Medium                   | features  | ready   | partial  |
| D6  | Urgent or Critical forces a written reason                                        | features  | ready   | partial  |
| D7  | A PM or Admin enters the estimated hours                                          | features  | ready   | partial  |
| D8  | Hours spent and hours remaining shown against the estimate                        | features  | ready   | partial  |
| D9  | Full project history: every change, who made it, when                             | features  | ready   | ready    |
| D10 | A PM or Admin edits name, description, dates and types at any time                | features  | ready   | ready    |
| D11 | More than one PM, Developer or Designer can be assigned at the same time          | PM doc    | ready   | gap      |
| D12 | Removing all Developers or Designers does not change the project status           | PM doc    | ready   | n/a      |
| D13 | A new member joining sees the full history but cannot modify historical records   | PM doc    | ready   | gap      |
| D14 | Developer Handover View: a reassigned developer sees history, logs and assets     | features1 | ready   | gap      |

D3 needs a `readiness` block on the project response. Today the rule lives in `ProjectsService` as a
transition guard, so the screen cannot show it before the user tries and fails.

## E. Moving a project forward

| #   | Requirement                                                                           | Source            | Backend | Frontend |
| --- | ------------------------------------------------------------------------------------- | ----------------- | ------- | -------- |
| E1  | Ten statuses, Planning through Cancelled                                              | features          | ready   | ready    |
| E2  | The statuses follow a fixed route, no skipping ahead                                  | features          | ready   | partial  |
| E3  | Every stage carries a plain English explanation on screen                             | features          | gap     | gap      |
| E4  | PMs, Admins, developers and designers can all advance a project                       | features          | ready   | partial  |
| E5  | Only an Admin can cancel a project                                                    | features          | ready   | partial  |
| E6  | On Hold and Cancelled require a written reason                                        | features          | ready   | partial  |
| E7  | A project with a future planned start date moves to Scheduled                         | PM doc            | ready   | n/a      |
| E8  | A planned start date of today or earlier moves the project straight to Ready For Work | PM doc            | ready   | n/a      |
| E9  | When a Scheduled project's start date arrives, the system moves it to Ready For Work  | PM doc            | gap     | n/a      |
| E10 | A Developer or Designer moves Ready For Work to In Progress when work begins          | PM doc            | ready   | partial  |
| E11 | Completed and Cancelled are final, no reopening                                       | features          | ready   | ready    |
| E12 | A project closed by mistake can be corrected                                          | features gap list | gap     | gap      |
| E13 | Archive rules, and who may archive                                                    | features, PM doc  | ready   | partial  |

E9 needs a scheduled job. Nothing in the backend promotes a Scheduled project when its date arrives:
the only crons are the three in `NotificationsSchedulerService`.

E11 and E12 contradict each other. See [Conflicts to resolve](#conflicts-to-resolve).

## F. Files and documents

| #   | Requirement                                                                               | Source            | Backend | Frontend |
| --- | ----------------------------------------------------------------------------------------- | ----------------- | ------- | -------- |
| F1  | A PM or Admin uploads PRD, requirements, meeting notes, credentials, assets, deliverables | features          | ready   | partial  |
| F2  | Documents are uploaded as files or typed straight into the tool                           | features          | ready   | partial  |
| F3  | Developers and designers open the documents they need without asking                      | features          | ready   | partial  |
| F4  | Deleted documents are hidden rather than destroyed                                        | features          | ready   | partial  |
| F5  | A credential is typed text, never a file                                                  | PM doc            | ready   | gap      |
| F6  | A file document records its type, size and format                                         | PM doc            | ready   | gap      |
| F7  | What a Client may see of the documents                                                    | features, PM doc  | ready   | gap      |
| F8  | Version history: a new upload does not silently replace the old file                      | features gap list | gap     | gap      |
| F9  | The tool stores contracts                                                                 | features gap list | gap     | gap      |

F7 is a conflict. See below.

## G. Time tracking

| #   | Requirement                                                              | Source            | Backend | Frontend |
| --- | ------------------------------------------------------------------------ | ----------------- | ------- | -------- |
| G1  | Only developers and designers assigned to a project may track time on it | features          | ready   | gap      |
| G2  | Start a timer                                                            | features          | ready   | gap      |
| G3  | Pause and resume                                                         | features          | ready   | gap      |
| G4  | Stop                                                                     | features          | ready   | gap      |
| G5  | Add a note explaining what the time was spent on                         | features          | ready   | gap      |
| G6  | One active timer per person, across all projects                         | features          | ready   | gap      |
| G7  | See who is working right now and on what                                 | features          | ready   | gap      |
| G8  | Totals per project, per day, and across all projects                     | features          | ready   | partial  |
| G9  | Clients see no time data                                                 | features          | ready   | n/a      |
| G10 | Meeting time is tracked separately                                       | backend           | ready   | partial  |
| G11 | Hours recalculated on the project whenever a timer stops                 | PM doc            | ready   | n/a      |
| G12 | Time counts only inside 9am to 6pm, Saturday to Thursday                 | features1         | gap     | n/a      |
| G13 | A timer left running does not keep counting overnight                    | features gap list | gap     | n/a      |

G12 and G13 are the two caveats `features.md` flagged for Jabed. Answered: neither is enforced. The
working-day constants exist (`src/common/working-day/`) and are used by the report services, but
nothing constrains a `TimeEntry`, and no cron closes an open one.

## H. Daily standups and wrap-ups

| #   | Requirement                                                        | Source   | Backend | Frontend |
| --- | ------------------------------------------------------------------ | -------- | ------- | -------- |
| H1  | A plan at the start of the day, saying what will be worked on      | features | ready   | partial  |
| H2  | A wrap-up at the end of the day, saying what was finished          | features | ready   | partial  |
| H3  | Written per project, one entry covering all of a person's projects | features | ready   | partial  |
| H4  | One standup per person per calendar day                            | PM doc   | ready   | n/a      |
| H5  | A PM or Admin reads every standup and leaves a comment on it       | features | ready   | partial  |
| H6  | Filter standups by person, date range or type                      | features | ready   | partial  |
| H7  | A PM may review only entries for projects they manage              | PM doc   | ready   | n/a      |
| H8  | The standup posts to the shared team Slack channel                 | PM doc   | ready   | n/a      |
| H9  | Each project's entry posts to that project's Slack channel         | PM doc   | ready   | n/a      |
| H10 | The wrap-up posts to both, the same way                            | PM doc   | ready   | n/a      |
| H11 | A reminder notification when a standup has not been submitted      | PM doc   | ready   | n/a      |

## I. Blockers

| #   | Requirement                                                           | Source    | Backend | Frontend |
| --- | --------------------------------------------------------------------- | --------- | ------- | -------- |
| I1  | Anyone assigned to a project reports a blocker, Admins on any project | features  | ready   | partial  |
| I2  | Severity Low, Medium or High                                          | features  | ready   | partial  |
| I3  | A reason picked from a list                                           | features  | ready   | partial  |
| I4  | A PM or Admin controls what reasons appear on that list               | features  | ready   | gap      |
| I5  | Open, In Progress, Resolved                                           | features  | ready   | partial  |
| I6  | A blocker is assigned to whoever needs to fix it                      | features  | ready   | partial  |
| I7  | Days open counted                                                     | features  | ready   | partial  |
| I8  | Whoever fixes it writes down how it was resolved                      | features  | ready   | partial  |
| I9  | The days a blocker pushed the deadline back are recorded              | features  | ready   | gap      |
| I10 | One screen per project showing which blockers cost the project time   | features  | ready   | gap      |
| I11 | Filter by status, severity, project or owner                          | features  | ready   | partial  |
| I12 | Clients cannot see blockers                                           | features  | ready   | n/a      |
| I13 | Blockers surface to the PM                                            | features1 | ready   | gap      |

## J. Extra client requests (additional requirements)

| #   | Requirement                                                               | Source            | Backend | Frontend |
| --- | ------------------------------------------------------------------------- | ----------------- | ------- | -------- |
| J1  | The PM types in a request that arrived by email, Slack or a call          | features          | ready   | partial  |
| J2  | The PM records where the request came from                                | features          | ready   | partial  |
| J3  | The PM approves or rejects it                                             | features          | ready   | partial  |
| J4  | On approval, the extra hours and the days the deadline moves are recorded | features          | ready   | partial  |
| J5  | A permanent record of who approved it and when                            | features          | ready   | partial  |
| J6  | AI compares the request against the PRD and flags in or out of scope      | features1, AI doc | ready   | gap      |
| J7  | Out of scope items land in the PM's inbox                                 | features1         | ready   | gap      |
| J8  | Approved items log to the project timeline and notify the developer       | features1         | ready   | n/a      |

## K. Internal review

| #   | Requirement                                                                     | Source            | Backend | Frontend |
| --- | ------------------------------------------------------------------------------- | ----------------- | ------- | -------- |
| K1  | A Developer or Designer moves the project to Internal Review when work is ready | PM doc            | ready   | partial  |
| K2  | The PM records what needs fixing, not just the status                           | features gap list | ready   | gap      |
| K3  | Every review is a record: reviewer, round, decision, comments, date             | PM doc            | ready   | gap      |
| K4  | Pass moves the project to Ready For Client                                      | PM doc            | ready   | partial  |
| K5  | Changes required moves the project to Ready For Work                            | PM doc            | ready   | partial  |
| K6  | A second round can be checked against the first                                 | features gap list | ready   | gap      |
| K7  | A revision can be marked done, from a list of revisions                         | features gap list | gap     | gap      |
| K8  | The PM annotates or draws on a design or a webpage                              | features gap list | gap     | gap      |

K8 is the one item recommended out of v1 scope. See [Recommended out of scope](#recommended-out-of-scope-for-v1).

## L. Client review and the client portal

| #   | Requirement                                                      | Source    | Backend | Frontend |
| --- | ---------------------------------------------------------------- | --------- | ------- | -------- |
| L1  | Each client gets their own login                                 | features  | ready   | ready    |
| L2  | A client sees only their own projects                            | features  | ready   | partial  |
| L3  | A client sees the status and the deadline, and nothing else      | features  | ready   | partial  |
| L4  | A client submits Approved or Changes Requested in the tool       | PM doc    | ready   | gap      |
| L5  | A PM records the client's response on the client's behalf        | PM doc    | ready   | gap      |
| L6  | Every response is a new record with an incrementing round number | PM doc    | ready   | gap      |
| L7  | Approved moves the project to Completed                          | PM doc    | ready   | n/a      |
| L8  | Changes Requested moves the project to Ready For Work            | PM doc    | ready   | n/a      |
| L9  | A client is notified when a project status changes               | features1 | ready   | gap      |
| L10 | A client sees Deliverable documents                              | PM doc    | ready   | gap      |

## M. Leave and availability

| #   | Requirement                                                         | Source   | Backend | Frontend |
| --- | ------------------------------------------------------------------- | -------- | ------- | -------- |
| M1  | Everyone internal requests leave, including Admins. Clients cannot  | features | ready   | partial  |
| M2  | An Admin sets up the leave types                                    | features | ready   | gap      |
| M3  | An Admin sets up the public holiday calendar                        | features | ready   | gap      |
| M4  | Everyone sees their own remaining balance                           | features | ready   | partial  |
| M5  | A PM sees all requests and opens them, but cannot approve or reject | features | ready   | partial  |
| M6  | Only an Admin approves or rejects                                   | features | ready   | partial  |
| M7  | People cancel their own pending requests                            | features | ready   | partial  |
| M8  | A leave summary, exportable                                         | backend  | ready   | partial  |

## N. Slack

| #   | Requirement                                                  | Source            | Backend | Frontend |
| --- | ------------------------------------------------------------ | ----------------- | ------- | -------- |
| N1  | A PM links a project to an existing channel by channel ID    | features          | ready   | ready    |
| N2  | Everyone on the project is invited automatically             | features          | ready   | ready    |
| N3  | The PM re-sends the invite if someone missed it              | features          | ready   | ready    |
| N4  | Every project screen shows whether Slack is connected        | features          | ready   | ready    |
| N5  | A channel is created automatically when a project is created | features gap list | ready   | ready    |
| N6  | Deadline reminders posted to each project's channel          | features1 Tab 1   | ready   | n/a      |

N5 is listed in `features.md` as something the tool does not do. It does:
`ProjectsService` calls `SlackService.createProjectChannel()` at creation. That gap is already closed.

## O. Notifications

| #   | Requirement                                      | Source          | Backend | Frontend |
| --- | ------------------------------------------------ | --------------- | ------- | -------- |
| O1  | An in-app notification list with an unread count | features1 Tab 1 | ready   | gap      |
| O2  | Mark one read, and mark all read                 | features1 Tab 1 | ready   | gap      |
| O3  | The per-role notification matrix, 29 event types | features1 Tab 1 | ready   | n/a      |
| O4  | Delivery to Slack as well as in-app              | features1 Tab 1 | ready   | n/a      |

## P. Oversight

| #   | Requirement                                                 | Source   | Backend | Frontend |
| --- | ----------------------------------------------------------- | -------- | ------- | -------- |
| P1  | An Admin opens an audit log of everything across the system | features | ready   | ready    |

## Q. Dashboards

| #   | Requirement                                                                           | Source            | Backend | Frontend |
| --- | ------------------------------------------------------------------------------------- | ----------------- | ------- | -------- |
| Q1  | The landing dashboard shows real numbers, not hardcoded ones                          | features gap list | gap     | gap      |
| Q2  | A working dashboard for the Admin and System Admin                                    | features gap list | gap     | gap      |
| Q3  | A working dashboard for the PM                                                        | features gap list | gap     | gap      |
| Q4  | A working dashboard for a Developer or Designer                                       | features1         | gap     | gap      |
| Q5  | A Developer or Designer dashboard shows only projects where they are an active member | PM doc            | ready   | gap      |
| Q6  | That list is ordered by priority, then deadline, then planned start date              | PM doc            | gap     | gap      |
| Q7  | Ready For Work and In Progress appear before completed or inactive projects           | PM doc            | gap     | gap      |
| Q8  | A dashboard for the Client                                                            | features1 Tab 2   | gap     | gap      |
| Q9  | The state of all projects at a glance                                                 | features gap list | gap     | gap      |

**This block is the single most visible gap in the product.** `features.md` calls it out as the one
item to fix before Saturday: "the tool telling people something untrue on the first screen they see."

## R. Reports and the AI module

| #   | Requirement                                                                        | Source    | Backend | Frontend |
| --- | ---------------------------------------------------------------------------------- | --------- | ------- | -------- |
| R1  | A per-project report: hours, blockers, requirements, reviews, feedback             | backend   | ready   | partial  |
| R2  | A per-developer report                                                             | backend   | ready   | partial  |
| R3  | AI templates, two kinds, one default each, Admin managed, staff readable           | AI doc    | ready   | gap      |
| R4  | A scope check on an additional requirement, requested explicitly by a PM           | AI doc    | ready   | gap      |
| R5  | A scope check verdict: in scope, out of scope or unclear, with confidence          | AI doc    | ready   | gap      |
| R6  | A scope check suggests extra hours, and never approves or blocks by itself         | AI doc    | ready   | gap      |
| R7  | A re-run replaces the previous answer                                              | AI doc    | ready   | gap      |
| R8  | A project summary, generated fresh, never saved, answered immediately              | AI doc    | ready   | gap      |
| R9  | A summary reflects only what was reported as done, never what was planned          | AI doc    | ready   | n/a      |
| R10 | A status report, saved, with a full history that is never overwritten              | AI doc    | ready   | gap      |
| R11 | A status report defaults to the period since the last one, or the last seven days  | AI doc    | ready   | gap      |
| R12 | A status report's numbers match the project's own calculated report                | AI doc    | ready   | n/a      |
| R13 | Background AI jobs return a job id, and the client polls it                        | AI doc    | ready   | gap      |
| R14 | AI generates a PRD                                                                 | features1 | gap     | gap      |
| R15 | AI estimates the hours needed to develop the project                               | features1 | gap     | gap      |
| R16 | On-demand reports: sprint progress, project delivery, team workload, client facing | features1 | partial | gap      |
| R17 | Export and share a report                                                          | features1 | gap     | gap      |

R16 is `partial`: the client-facing one is the AI status report, which exists. Sprint progress,
project delivery and team workload do not.

## S. Timeline and Gantt

| #   | Requirement                                   | Source            | Backend | Frontend |
| --- | --------------------------------------------- | ----------------- | ------- | -------- |
| S1  | A project-level Gantt timeline, per developer | features1 Tab 1   | served  | partial  |
| S2  | Export the timeline as PDF                    | features1 Tab 1   | gap     | gap      |
| S3  | See how projects overlap                      | features gap list | served  | done     |
| S4  | See who is loaded in which week               | features gap list | gap     | gap      |

**S1 is partial, and deliberately.** The timeline groups by the project MANAGER, which is what the
screens the user supplied show and what a staffing conversation turns on. `features1` asks for it per
DEVELOPER, which is a different axis: one developer appears on several projects under several
managers, so their row is a merge rather than a group. Both readings are useful and the geometry
already supports either, since `groupByLead` is the only piece that would change. Grouping by
assignee is what S4 needs anyway, so the two belong in one piece of work rather than two.

## T. Exporting

| #   | Requirement                   | Source            | Backend | Frontend |
| --- | ----------------------------- | ----------------- | ------- | -------- |
| T1  | Export project lists to CSV   | features gap list | gap     | gap      |
| T2  | Export leave records          | features gap list | ready   | partial  |
| T3  | Export a report to PDF        | features gap list | gap     | gap      |
| T4  | Export blockers and time data | features gap list | gap     | gap      |

## U. Things that run on their own

| #   | Requirement                                                       | Source            | Backend | Frontend |
| --- | ----------------------------------------------------------------- | ----------------- | ------- | -------- |
| U1  | Missed standup and missed wrap-up reminders                       | PM doc            | ready   | n/a      |
| U2  | Deadline approaching reminders                                    | features1 Tab 1   | ready   | n/a      |
| U3  | Scheduled projects promoted to Ready For Work on their start date | PM doc            | gap     | n/a      |
| U4  | A timer left running is closed at the end of the working day      | features gap list | gap     | n/a      |
| U5  | Scheduled reports                                                 | features gap list | gap     | gap      |

---

## Backend gaps, consolidated

The 32 backend gaps this build needs to close, grouped by the phase that delivers them. Everything else in
the inventory above is already served.

| Ref                 | Backend work                                                                          |
| ------------------- | ------------------------------------------------------------------------------------- |
| Q1 to Q9            | Per-audience dashboard endpoints, every number a response field, ordering server side |
| D3                  | A `readiness` block on the project response                                           |
| E3                  | A plain English `description` on every status and priority display object             |
| E9, U3              | A cron that promotes a Scheduled project when its planned start date arrives          |
| E12                 | Reopening a Completed or Cancelled project, Admin only, with a required reason        |
| F8                  | Document version history                                                              |
| F9                  | A `CONTRACT` document type                                                            |
| G12                 | The 9am to 6pm, Saturday to Thursday counting window on a time entry                  |
| G13, U4             | A cron that closes a timer left running past the working day                          |
| K7                  | A revision checklist against an internal review round                                 |
| C6, R15             | An AI hours estimate, offered at creation and re-runnable                             |
| R14                 | AI PRD generation                                                                     |
| R16                 | Sprint progress, project delivery and team workload reports                           |
| S1, S3, S4          | A timeline endpoint, and a per-week workload endpoint                                 |
| T1, T3, T4, S2, R17 | CSV and PDF export endpoints                                                          |
| U5                  | Scheduled report delivery                                                             |

---

## Conflicts to resolve

Six places where the documents disagree, or leave a question the schema cannot answer. Each needs a
decision before the screen that depends on it is built. A recommendation is given for each.

| #   | The conflict                                                                                                                                         | Recommendation                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| X1  | **Archiving.** `features.md`: only a Completed or Cancelled project may be archived. `Project Module.md`: archiving is independent of status         | Follow `Project Module.md`, since it is the rules document. The backend currently follows `features.md`          |
| X2  | **Client documents.** `features.md`: clients cannot see any documents. `Project Module.md`: a client sees Deliverable documents only                 | Follow `Project Module.md`. The backend already enforces the reduced projection, so this is a frontend build     |
| X3  | **Reopening.** `features.md` states Completed and Cancelled are final, and separately lists "no way to correct a project closed by mistake" as a gap | Add a reopen action restricted to Admin, requiring a reason, recorded as an activity. Finality stays the default |
| X4  | **Two timers.** `Project Module.md` asks whether a person may run one timer per project or one in total                                              | One in total. The backend already enforces it globally, and `features.md` states it as a rule                    |
| X5  | **Estimated hours.** `features.md`: the PM enters them. `features1.md`: AI generates them at creation                                                | Both. AI suggests, the PM confirms or overrides. The stored value is always the PM's                             |
| X6  | **Who reports a blocker.** `features.md`: anyone assigned, plus Admins on any project. `features1.md`: a developer                                   | Follow `features.md`, which the backend already implements                                                       |

Two further questions `Project Module.md` raises and answers nowhere:

- Can a wrap-up be submitted with no standup that day, and can a missed standup be filed the next
  day? The backend's `DailyWorkReport` has a status machine, so the answer is in the code rather than
  in the docs. Confirm it matches what the team wants before building the form.
- Is there a cutoff after which a standup can no longer be edited? Not implemented, and not required
  by any document. Left alone unless asked for.

---

## Recommended out of scope for v1

| Item                                             | Why                                                                                                                                                                                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K8, annotating or drawing on a design or webpage | This is a product in itself: a canvas overlay, a screenshot or proxy pipeline, anchored comment threads, and versioning of the annotated surface. It does not fit alongside the rest of this scope, and nothing else in the build depends on it |
| Excel export                                     | CSV opens in Excel. Two formats doubles the surface for no capability gained                                                                                                                                                                    |
| U5, scheduled reports                            | Worth doing, but it depends on the report and export work landing first. Sequenced last, and the first candidate to drop if time runs short                                                                                                     |

Both are listed so that dropping them is a decision on the record rather than an omission.
