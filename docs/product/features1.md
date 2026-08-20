# Tab 1

## **Tool v1 — What the tool can do**

**Project management**

- Create projects, assign developers, set and edit deadlines
- AI hours estimate auto-generated at project creation
- Project status lifecycle, including "Ready for Client" as an internal state
- PM marks a project Completed
- Project-level Gantt timeline per developer; export as PDF
- Full chronological Project Log per project
- Project Overview Panel — hours worked, hours remaining, status
- Developer Handover View — reassigned developer sees full history, logs, assets
- PM, developer, and client can all view a completed project

**Time & work tracking**

- Timer-based tracking per project, start/stop, no manual entry
- Counts only within 9am–6pm, Sat–Thu
- AI Estimated vs actual hours, hours remaining
- Daily standup log per project — did / doing / blockers
- PM views all standup logs and comments on them

**People & availability**

- Work status: sick, casual, WFH, onsite
- Availability: ready or occupied
- Visibility of how many and which projects each developer is on
- Leave requests, approved by Admin/CTO

**Documents**

- Document & Asset Hub — PRDs, project assets, credentials, client requirements
- Developers view PRD and assets; credentials visible to PM and developers

**Blockers**

- Report a blocker against a project with severity
- Track open duration
- Resolve with explanation
- Blockers surface to PM via notification

**AI**

- Generate a PRD
- Scope-check a request against the PRD, auto-flag out-of-scope items as Additional Requirements
- Project progress overview
- On-demand reports: sprint progress, project delivery, team workload, client-facing
- Export and share reports
- Estimate Require Time to develop the project

**Additional Requirement flow (PM-initiated)**

- PM manually enters a client request received outside the tool
- AI compares it against the PRD
- Out-of-scope items flagged as Additional Requirements in PM's inbox
- PM approves, negotiates(manually outside of the tool), or rejects
- Approved items log to Project Log and notify the developer
- May affect deadline and hours estimate

**Client portal**

- Client account created by Admin/CTO at project start
- Client sees only their own projects
- Read-only: status and deadline
- Pull-only — client notifications- when project status changes.

**Notifications**

- PM: developer marks work complete · project status changes · 2 days before the deadline . approved/ declines leave requests( self)+ approved leave requests of developer
- Developer: new project assigned · new requirement added _(two distinct types)_ . approved/ declines leave requests
- Admin/CTO: mirrors every PM notification, plus leave requests
- Channels: in-app, Slack channel(when project created).

**Slack**

- Auto-creates a project channel on project creation
- Deadline reminders to channel of each project

**Admin/CTO**

- Full unrestricted access to all data and modules
- Create, edit, delete accounts across all roles
- Only role that can delete projects
- Override PM decisions, reassign projects
- Approve and reject leave
- Manage system settings including Slack integration

# Tab 2

# **What the tool can do**

## **Getting in**

- Anyone on the team logs in with their email and password.
- If someone forgets their password, they get a code by email and set a new one themselves.
- On first login, the tool makes the person set their own password and fill in their profile before they can use it.
- Everyone can switch between light and dark mode.

## **People**

- The Admin invites a new person by email.
- Every person gets one of six roles: System Admin, Admin, Project Manager, Developer, Designer, or Client.
- Each role sees a different menu, so people only see what belongs to their job.
- Anyone can view and update their own profile and photo.

## **Projects**

- The PM creates a project with a name, description, client, start date, and deadline.
- The PM assigns developers and designers to the project.
- The PM tags what kind of project it is — WordPress, Webflow, Wix, Framer, Figma, MERN, or SEO.
- The PM sets a priority from Low up to Critical, and writes a reason when a project is rushed.
- The PM moves the project through ten stages, from Planning to Completed.
- The PM writes down why a project was put on hold or cancelled.
- The PM enters the estimated hours a project should take.
- The tool shows how many hours have actually been spent and how many are left.
- Anyone on the project can see a full history of everything that happened on it, in order, with who did it and when.
- The PM edits or archives a project at any time.

## **Files and documents**

- The PM uploads the PRD, client requirements, meeting notes, login credentials, design assets, and final deliverables to the project.
- Documents can be uploaded as files or typed directly into the tool.
- Developers open the PRD, assets, and credentials they need without asking anyone.
- Deleted documents are hidden but not destroyed, so nothing is lost by accident.

## **Time tracking**

- A developer starts a timer when they begin work on a project.
- They pause the timer for a break and resume it after.
- They stop the timer when they finish for the day.
- They add a note explaining what the time was spent on.
- The tool shows who is working right now and on what.
- The tool adds up the hours per project, per day, and across all projects.

## **Daily standups**

- Every developer writes a plan at the start of the day saying what they will work on.
- Every developer writes a wrap-up at the end of the day saying what they finished.
- Both are written per project, so one person covers all their projects in a single entry.
- The PM reads every standup and leaves a comment on it.
- The PM filters standups by person, by date, or by type.

## **Blockers**

- A developer reports a blocker the moment something stops their work.
- They pick how serious it is: Low, Medium, or High.
- They pick a reason from a list the Admin controls.
- The PM assigns the blocker to whoever needs to fix it.
- The tool counts how many days the blocker has been open.
- Whoever fixes it writes down how it was resolved.
- The PM records how many days the blocker pushed the deadline back.
- The PM opens one screen per project showing exactly which blockers cost the project time.
- The PM filters blockers by status, severity, project, or who owns them.

## **Extra client requests**

- When a client asks for something new by email, Slack, or on a call, the PM enters it into the tool.
- The PM records where the request came from.
- The PM approves or rejects it.
- When approving, the PM records the extra hours it will take and how many days the deadline moves.
- The tool keeps a permanent record of who approved it and when.

## **Leave and availability**

- Anyone on the team requests leave through the tool.
- The Admin sets up the leave types and the public holiday calendar.
- Everyone sees their own remaining leave balance.
- The Admin approves or rejects each request.
- People cancel their own requests if plans change.

## **Slack**

- The PM links a project to a Slack channel.
- Everyone on the project is automatically invited to that channel.
- The PM re-sends the invite if someone missed it.
- Every project screen shows whether Slack is connected or not.

## **Oversight**

- The Admin opens an audit log showing everything that has happened across the whole system.
- Every role lands on a dashboard built for their job.

## **Clients**

- Each client gets their own login.
- A client sees only their own projects — never anyone else's.
- A client sees the project status and the deadline, and nothing more.
