# Project Module Rule

### **Project Module**

**Project Creation & Staffing**

- A project is created by an Admin, System Admin, or Project Manager.
- A project is tagged with one or more Project Types, for example, a WordPress project that also includes SEO work.
- A project starts in Planning status with no team assigned.
- A project stays in Planning until a Project Manager and at least one Developer or Designer are assigned.
- A Project Manager checks availability status before assigning a Developer or Designer to a project.
- A project with a future planned start date moves to Scheduled.
- If the planned start date is today or has already passed, the project moves directly to Ready For Work.
- When the planned start date of a Scheduled project arrives, the system moves it to Ready For Work.
- A Developer or Designer moves the project from Ready For Work to In Progress when work begins.

**Project Status**

- A project status is one of Planning, Scheduled, Ready For Work, In Progress, On Hold, Internal Review, Ready For Client, Waiting For Feedback, Completed, or Cancelled.
- A project moves to On Hold with a required reason.
- A project moves back to Ready For Work when work resumes from On Hold.
- When a Developer or Designer begins working again, the project moves from Ready For Work to In Progress.
- A project moves to Cancelled from any pre-completion status, restricted to Admin and System Admin, with a required reason.
- Archiving a project is independent of its status, a Completed project and a Cancelled project can both be archived.
- Removing all Developers or Designers from a project does not change its status. The project remains in its current status until new team members are assigned.

**Project Priority**

- Every project has a priority of Low, Medium, High, Urgent, or Critical.
- The default priority is Medium.
- Only an Admin, System Admin, or Project Manager can change a project's priority.
- Changing a project's priority creates a ProjectActivity entry.
- A rushReason may be required when setting a project's priority to Urgent or Critical.

**Project Activity**

- Every significant project event creates a ProjectActivity record.
- Project activities provide a chronological timeline of the project's history.
- Activities include project creation, status changes, team changes, document updates, standup submissions, wrap ups, client feedback, deadline changes, priority changes, project completion, cancellation, and archival.
- Project activities are immutable and serve as the project's historical record.

**Internal Review**

- A Developer or Designer moves a project to Internal Review once their assigned work is complete and ready for review.
- A Project Manager reviews the submitted work before it is shared with the Client.
- Every internal review creates a ProjectInternalReview record, preserving the complete review history, including the reviewer, review round, decision, comments, and review date.
- If the internal review passes, the Project Manager moves the project to Ready For Client.
- If the internal review requires revisions, the Project Manager moves the project to Ready For Work.
- A project remains in Ready For Work until a Developer or Designer resumes work.
- When a Developer or Designer begins working on the requested revisions, the project moves from Ready For Work to In Progress.

**Client Review**

- A Client can view only the status of their own projects and documents marked as Deliverable.
- A Client submits feedback by selecting either Approved or Changes Requested directly within the system.
- Every client response is stored as a new ClientFeedback record, preserving the complete feedback history and never overwriting previous rounds.
- When feedback is received outside the system, such as by email, phone call, or a marketplace platform, a Project Manager records the Client's response on the Client's behalf.
- Each ClientFeedback record stores both the Client who provided the feedback and, when applicable, the Project Manager who recorded it.
- An Approved response moves the project to Completed.
- A Changes Requested response moves the project to Ready For Work, indicating that additional work is required.
- A project remains in Ready For Work until a Developer or Designer resumes work.
- When a Developer or Designer begins working on the requested revisions, the project moves from Ready For Work to In Progress.

**Project Team**

- A project can have more than one Project Manager, Developer, or Designer assigned at the same time.
- Adding a team member always creates a new ProjectMember record.
- Removing a team member never deletes or updates previous membership records. Instead, the member leaves the project by setting leftAt, preserving the complete membership history.
- If the same user joins the project again later, a new ProjectMember record is created. Previous membership records remain unchanged.
- Only ProjectMember records where leftAt is NULL are considered active team members.
- Every active team member has access to the project's complete history, including documents, standups, additional requirements, client feedback, and project activities.
- Every team membership change, such as joining or leaving a project, creates a corresponding ProjectActivity entry, providing a chronological timeline of the project's history.
- A new team member joining an existing project can view the full project timeline, including previous documents, standups, client feedback, additional requirements, and project activities, but cannot modify historical records.

**Documents & Credentials**

- A project document is either typed text or an uploaded file.
- A credential is stored as typed text, not as a file.
- A file document records its type, its file size, and its file format.
- Only an Admin, System Admin, or Project Manager uploads or types a project document.
- A Client never uploads, types, or edits a project document.
- A Client sees only Deliverable-type documents , a live website link, a Figma link, or similar.
- A Client never sees a PRD, a Requirement, a Meeting Note, a Credential, or an internal Asset.

**Time Tracking**

- A Developer or Designer starts and stops a timer to record work on a project.
- The system prevents a Developer or Designer from starting another timer while an active timer already exists.
- The system recalculates actual and remaining project hours whenever a timer stops.

**Daily Standup & Wrap-Up**

- A Developer or Designer submits one standup per working day.
- A standup consists of one entry for each project the user plans to work on that day.
- The user selects one or more projects and provides a plan and any blockers for each project in a single standup form.
- The entire standup is submitted in one action, creating one DailyStandup record and one StandupEntry record for each selected project.
- After submission, the system posts the complete standup to the shared team standup Slack channel.
- The system also posts each project's individual standup entry to that project's dedicated Slack channel, using only that project's plan and blockers.
- A Developer or Designer submits one wrap up per working day using the same projects selected for that day's standup.
- Each user can have only one DailyStandup record per calendar day.
- The wrap up is submitted as a single action and updates the existing StandupEntry records for that day.
- After submission, the system posts the complete wrap up to the shared team wrap up Slack channel.
- The system also posts each project's individual wrap up entry to that project's dedicated Slack channel.
- A Project Manager may review and comment only on the StandupEntry records belonging to projects they manage.
- A review applies only to the individual project entry and does not affect the user's other project entries.
- If a Developer or Designer has not submitted a standup for the current day, the system may send reminder notifications.

**Additional Requirements**

- An Admin, System Admin, or Project Manager uploads a requirement received outside the system.
- The AI system compares the new requirement against the original project requirements and flags it as in-scope or out-of-scope.
- A Project Manager approves or rejects an out-of-scope requirement.
- An approved additional requirement may increase the project's estimated hours and extend its deadline.

**Client Feedback**

- Each round of client feedback is assigned an incrementing feedbackRound number.

**Developer/Designer Dashboard**

- A Developer or Designer sees only projects where they are an active ProjectMember.
- Projects are ordered primarily by Priority, then by Deadline, and finally by Planned Start Date.
- Projects in Ready For Work and In Progress appear before completed or inactive projects.

**Status changes**

- How does a project actually go from "Ready For Client" to "Waiting For Feedback"?
- Who is allowed to put a project On Hold?
- Can a Completed or Cancelled project ever change status again?
- If all Developers/Designers leave a project, does it go back to Planning?
- What if the start date is today or already passed

### **Internal Review (PM checking work before client sees it)**

- Client feedback gets saved as a record every time (with a round number). But when a PM reviews work internally, **there's no record kept** — no history of how many times it was reviewed, who reviewed it, or why it passed/failed

### **Documents & Credentials**

- Can documents be edited or deleted after upload?

### **Timers**

- No mention of office hours
- If someone works on two projects, can they run two timers at once (one per project), or only one timer total?
- If someone forgets to stop a timer, does it ever auto-stop?

### **Standup & Wrap-up**

- Can someone submit a wrap-up if they never submitted a standup that day?
- Can someone submit a late/missed standup the next day?
- Is there a cutoff time after which you can't submit or edit anymore?

# Project Database Schema

| enum ProjectStatus { PLANNING  SCHEDULED READY\_FOR\_WORK  IN\_PROGRESS ON\_HOLD INTERNAL\_REVIEW  READY\_FOR\_CLIENT  WAITING\_FOR\_FEEDBACK COMPLETED CANCELLED} enum ProjectPriority { LOW MEDIUM HIGH URGENT CRITICAL } enum ProjectRole { PROJECT\_MANAGER DEVELOPER DESIGNER}enum ProjectDocumentType { PRD REQUIREMENT MEETING\_NOTE CREDENTIAL ASSET DELIVERABLE}enum ProjectType { WORDPRESS WEBFLOW WIX FRAMER FIGMA MERN\_STACK SEO}enum ProjectDocumentFormat { TEXT // credentials, quick notes \-- typed directly, no file FILE // pdf, docx, image, zip, etc.}enum AdditionalRequirementStatus { PENDING\_REVIEW APPROVED REJECTED} enum InternalReviewDecision { APPROVED CHANGES\_REQUIRED }enum ClientFeedbackDecision { APPROVED CHANGES\_REQUESTED} enum ProjectActivityType {PROJECT\_CREATED PROJECT\_DETAILS\_UPDATED STATUS\_CHANGED PRIORITY\_CHANGED MEMBER\_JOINED MEMBER\_LEFT DEADLINE\_CHANGED DOCUMENT\_ADDED DOCUMENT\_UPDATED DOCUMENT\_REMOVED TIME\_STARTED TIME\_STOPPED STANDUP\_SUBMITTED WRAP\_UP\_SUBMITTED ADDITIONAL\_REQUIREMENT\_ADDED ADDITIONAL\_REQUIREMENT\_REVIEWED INTERNAL\_FEEDBACK\_RECEIVED CLIENT\_FEEDBACK\_RECEIVED PROJECT\_COMPLETED PROJECT\_CANCELLED PROJECT\_ARCHIVED} enum DailyStandupStatus { NOT\_STARTED STANDUP\_SUBMITTED COMPLETED } model Project { id String name String description String? status ProjectStatus progressPercentage Int  clientId String client User  createdById String createdBy User  estimatedHours Float? // from AI estimation actualHours Float // recalculated from TimeEntry remainingHours Float? slackChannelId String? // Scheduling \-- "assigned" and "actually started" are different moments plannedStartDate DateTime? actualStartedAt DateTime? lastWorkedAt DateTime? readyForClientAt DateTime? deadline DateTime? priority ProjectPriority @default(MEDIUM) rushReason String? completedAt DateTime? onHoldReason String? cancellationReason String? members ProjectMember\[\] activities ProjectActivity\[\] documents ProjectDocument\[\] projectTypeTags ProjectTypeTag\[\] timeEntries TimeEntry\[\] standupEntries StandupEntry\[\] additionalRequirements AdditionalRequirement\[\] internalFeedback ProjectInternalReview\[\] clientFeedback ClientFeedback\[\]  createdAt DateTime updatedAt DateTime  archivedAt DateTime? @@index(\[status\]) @@index(\[clientId\])}model ProjectMember { id String projectId String project Project userId String user User role ProjectRole joinedAt DateTime leftAt DateTime? createdAt DateTime updatedAt DateTime @@index(\[projectId\]) @@index(\[userId\]) @@index(\[role\]) @@index(\[leftAt\]) @@index(\[projectId, leftAt\]) } model ProjectTypeTag { id String  projectId String project Project  type ProjectType createdAt DateTime  @@unique(\[projectId, type\]) @@index(\[projectId\]) @@index(\[type\])}model ProjectActivity { id String projectId String project Project userId String? user User? type ProjectActivityType message String? metadata Json? createdAt DateTime @@index(\[projectId\]) @@index(\[projectId, createdAt\]) @@index(\[type\]) @@index(\[userId\]) } model ProjectDocument { id String  projectId String project Project description String?  type ProjectDocumentType format ProjectDocumentFormat title String  // FILE format fileUrl String? fileMimeType String? fileSizeBytes Int? // TEXT format \-- e.g. credentials, quick notes textContent String? uploadedById String uploadedBy User  createdAt DateTime updatedAt DateTime deletedAt DateTime? @@index(\[projectId\])}model TimeEntry { id String  projectId String project Project  userId String user User notes String?  startedAt DateTime  endedAt DateTime? durationMinutes Int? @@index(\[projectId\]) @@index(\[userId\])} model DailyStandup { id String userId String user User  date DateTime @db.Date status DailyStandupStatus @default(NOT\_STARTED)  standupSubmittedAt DateTime? wrapUpSubmittedAt DateTime? entries StandupEntry\[\] createdAt DateTime updatedAt DateTime @@unique(\[userId, date\]) @@index(\[userId\]) @@index(\[date\])}model StandupEntry { id String  dailyStandupId String dailyStandup DailyStandup projectId String project Project  planForToday String? blockers String? wrapUpNotes String? reviewedById String? reviewedBy User?  reviewedAt DateTime? reviewComment String? @@unique(\[dailyStandupId, projectId\]) @@index(\[projectId\])}model AdditionalRequirement { id String projectId String project Project  description String sourceChannel String? // "email", "fiverr", "upwork", "direct" aiScopeAnalysis Json? // AI's in/out-of-scope reasoning status AdditionalRequirementStatus @default(PENDING\_REVIEW) uploadedById String uploadedBy User  reviewedById String? reviewedBy User?  reviewedAt DateTime? approvedAdditionalHours Float? extendedDeadline DateTime? createdAt DateTime updatedAt DateTime @@index(\[projectId\])} model ProjectInternalReview { id String projectId String project Project reviewedById String reviewedBy User decision InternalReviewDecision comments String? reviewRound Int createdAt DateTime @@unique(\[projectId, reviewRound\]) @@index(\[projectId\]) }model ClientFeedback { id String  projectId String project Project  clientId String client User  recordedById String?  recordedBy User?  decision ClientFeedbackDecision comments String? feedbackRound Int createdAt DateTime  @@index(\[projectId\]) @@unique(\[projectId, feedbackRound\])} |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
