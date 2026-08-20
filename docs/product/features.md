# What the tool can do — v1

# **Featurs need to present**

## **Getting in**

- Anyone on the team logs in with their email and password.
- If someone forgets their password, they get a code by email and set a new one themselves.
- On first login, the tool makes the person set their own password before they can continue.
- On first login, the tool makes the person fill in their profile before they can continue.
- Everyone can switch between light and dark mode.

## **People**

- An Admin invites a new person by email.
- Every person gets one of six roles: System Admin, Admin, Project Manager, Developer, Designer, or Client.
- Each role sees a different menu, so people only see what belongs to their job.
- Anyone can view and update their own profile and photo.
- An Admin can open any person's record and see their details.

## **Creating a project**

- A PM or an Admin creates a project.
- Every project must have a name, a client, and at least one project type. The tool will not let you save without them.
- Project types are WordPress, Webflow, Wix, Framer, Figma, MERN, and SEO. A project can carry more than one.
- Description, start date, and deadline are optional at creation and can be added later.

## **Running a project**

- A PM or an Admin assigns developers and designers to the project.
- **When you assign someone who is already carrying a lot of work, the tool warns you.**
- **The project screen shows a live readiness checklist** — whether a PM is assigned, and whether a developer or designer is assigned — and tells you to fix it before the project leaves Planning.
- People who leave a project are kept in the record and shown separately from the current team, so the history of who worked on it survives.
- A PM or an Admin sets the priority, from Low up to Critical.
- **Choosing Urgent or Critical forces you to write a reason. The tool will not save without it.**
- A PM or an Admin enters the estimated hours the project should take.
- The tool shows the hours actually spent and the hours remaining against that estimate.
- Everyone internal can see a full history of the project — every change, who made it, and when.
- A PM or an Admin edits the project name, description, dates, and types at any time.

## **Moving a project forward**

- A project moves through ten stages: Planning, Scheduled, Ready for Work, In Progress, On Hold, Internal Review, Ready for Client, Waiting for Feedback, Completed, Cancelled.
- **The stages follow a fixed route. You cannot skip ahead.** Work in progress must pass through Internal Review and Ready for Client before it can be marked Completed.
- **Every stage carries a plain-English explanation on screen**, so nobody has to guess what it means.
- PMs, Admins, developers, and designers can all move a project to its next stage.
- **Only an Admin can cancel a project.**
- Whoever puts a project on hold or cancels it writes down the reason.
- **Completed and Cancelled are final. A project cannot be reopened.**
- **A project can only be archived once it is Completed or Cancelled**, and only by an Admin or by the PM assigned to it.

## **Files and documents**

- A PM or an Admin uploads documents to a project: the PRD, client requirements, meeting notes, login credentials, design assets, and final deliverables.
- Documents can be uploaded as files or typed straight into the tool.
- Developers and designers open the documents they need without asking anyone.
- Clients cannot see any documents.
- Deleted documents are hidden rather than destroyed, so nothing is lost by accident.

## **Time tracking**

- **Only developers and designers who are assigned to a project can track time on it.** PMs and Admins cannot.
- A developer starts a timer when they begin work.
- They pause it for a break and resume it after.
- They stop it when they finish.
- They add a note explaining what the time was spent on.
- **The tool stops anyone running two timers on two projects at the same time.**
- The tool shows who is working right now and on what.
- The tool adds up hours per project, per day, and across all projects.
- Clients cannot see any time data.

## **Daily standups**

- Developers and designers write a plan at the start of the day saying what they will work on.
- They write a wrap-up at the end of the day saying what they finished.
- Both are written per project, so one person covers all their projects in a single entry.
- A PM or an Admin reads every standup and leaves a comment on it.
- A PM or an Admin filters standups by person, by date range, or by type.

## **Blockers**

- **Anyone assigned to a project can report a blocker** the moment something stops the work — developer, designer, or PM. Admins can report on any project.
- They pick how serious it is: Low, Medium, or High.
- They pick a reason from a list.
- **A PM or an Admin controls what reasons appear on that list.**
- A blocker moves through Open, In Progress, and Resolved.
- A blocker can be assigned to whoever needs to fix it.
- The tool counts how many days it has been open.
- Whoever fixes it writes down how it was resolved.
- The days a blocker pushed the deadline back are recorded against it.
- **One screen per project shows exactly which blockers cost the project time**, and how much.
- Blockers can be filtered by status, severity, project, or owner.
- Clients cannot see blockers.

## **Extra client requests**

- When a client asks for something new by email, Slack, or on a call, the PM types it into the tool.
- The PM records where the request came from.
- The PM approves or rejects it.
- On approval, the PM records the extra hours it will take and how many days the deadline moves.
- The tool keeps a permanent record of who approved it and when.

## **Leave and availability**

- Everyone internal requests leave through the tool — including Admins. Clients cannot.
- An Admin sets up the leave types and the public holiday calendar.
- Everyone sees their own remaining leave balance.
- **A PM can see all leave requests and open them for review, but cannot approve or reject.**
- **Only an Admin approves or rejects a request.**
- People cancel their own pending requests if plans change.

## **Slack**

- A PM links a project to a Slack channel that already exists, using the channel ID.
- Everyone on the project is automatically invited to that channel.
- The PM re-sends the invite if someone missed it.
- Every project screen shows whether Slack is connected or not.

## **Oversight**

- An Admin opens an audit log showing everything that has happened across the whole system.

## **Clients**

- Each client gets their own login.
- A client sees only their own projects — never anyone else's.
- A client sees the status and the deadline, and nothing else.

# tool does not do \- not completed yet.

# **Features need to present**

_Excluding the AI module and the Notifications module — both not started, tracked separately._

## **No timeline view**

- It does not draw a Gantt chart or any timeline.
- Nobody can see how projects overlap, or who is loaded in which week.

## **No exporting**

- It does not export any data — project lists, leave records — to PDF, Excel, or CSV.
- Anything you want out of the tool has to be copied by hand.

## **The dashboard is not real**

- The dashboard everyone lands on shows hardcoded numbers. "Open projects" always says 8\. "Ready this week" always says 14\.
- There is no working dashboard for the PM.
- There is no working dashboard for the Admin.
- Nobody can see the state of all projects at a glance.

## **No feedback record on the work**

- There is nowhere in the tool to leave feedback on a project's actual work.
- There is no comment thread on a project. The only comment box in the whole tool is on a daily standup entry.
- **Internal Review is a status with no content.** A PM can move a project into it but cannot record what needs fixing.
- Sending a project back from Internal Review to Ready for Work captures no reason at all. Only On Hold and Cancelled ask for one.
- There is no record of what was raised in a review round, so a second round cannot be checked against the first.
- Nobody can mark a revision as done, because there is no list of revisions.
- The PM cannot draw on or annotate a design or a webpage.

## **Slack channels are created by hand**

- The tool does not create a Slack channel when a project is created. Someone has to make the channel in Slack, copy the channel ID, and paste it into the project.
- Because of that, members are not invited at project creation — only after someone does the manual linking step.
- If the linking step is skipped, the project has no Slack presence and nobody notices. 7

## **Projects lock permanently**

- A Completed project cannot be reopened.
- A Cancelled project cannot be reopened.
- There is no way to correct a project closed by mistake.

## **Document gaps**

- It keeps no version history. A new upload replaces the old file with no record of what changed.
- It does not store contracts.

## **Time and hours gaps**

- The timer does not stop at the end of the working day. Left running overnight, it keeps counting.
- Nothing enforces the 9am–6pm, Saturday–Thursday working window.
- Estimated hours are never compared back against actuals, so estimates never improve.

## **Nothing runs on its own**

- No scheduled reports, no automatic reminders, no recurring anything.
- Every action in the tool requires a person to do it.

---

**Two caveats.** This is judged from the frontend only — the timer overnight behaviour and the working-window rule could be enforced in the backend where I can't see. Worth five minutes with Jabed.

**One item I'd fix before Saturday:** the hardcoded dashboard numbers. Everything else on this list is an honest gap you can name in the room. That one is the tool telling people something untrue on the first screen they see.
