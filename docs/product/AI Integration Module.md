# Business Rules

**AI Templates (reference data)**

A template is a written outline that tells Claude what sections a summary or a status report should contain.

There are two kinds of template: one for the project summary, one for the status report.

Only one template of each kind can be the default at a time.

Everyone with staff access can read templates. Only an Admin or System Admin can create, edit, or delete one.

The default template's content becomes Claude's instructions directly, with no code change needed to adjust it.

The scope checker does not use a template at all. Its instructions are fixed in code, since its answer is a strict format, not free writing.

**Feature 1: Scope Checker**

Every additional requirement can optionally be checked against the project's existing scope.

Checking a requirement's scope is never automatic. A Project Manager must explicitly request it.

Only a Project Manager staffed on that specific project, or an Admin or System Admin, may request a scope check.

A scope check compares a requirement's own description against the project's PRD and Requirement documents.

If a project has no PRD or Requirement documents at all, no AI call happens, but a clear explanation is still recorded.

A scope check answers whether a requirement is in scope, out of scope, or unclear, and how confident that answer is.

A scope check also estimates whether the requirement would need extra hours beyond what is already estimated.

Every scope check answer includes a plain written reason, even when nothing could be compared.

Requesting a scope check again on the same requirement replaces its previous answer. Past answers are not kept.

A scope check answer is only a suggestion. It never approves, rejects, or blocks a requirement by itself.

A Project Manager still must explicitly approve or reject every requirement, regardless of what the scope check says.

A requirement's approved extra hours are chosen by the Project Manager, whether or not they match the AI's suggestion.

**Feature 2: Project Summary**

Anyone with project access can request a quick written summary of how a project is doing.

A Project Manager, Admin, or System Admin can request a summary for any project.

A Developer or Designer can request a summary only for a project they are actively staffed on.

A Client can never request a project summary.

A project summary answers immediately. It never waits in a background queue.

A project summary is generated fresh every time it is requested. Nothing about it is ever saved.

A project summary is based on the project's PRD, if one exists, and what was actually accomplished in the requested date range.

A project summary deliberately ignores what was planned. It only reflects what people reported as actually done.

A project with nothing accomplished yet in the requested range still returns a summary, just a thin one, never an error.

**Feature 3: AI Status Report**

A fuller, saved status report can be generated for a project, meant to be shared with a client or with leadership.

Only a Project Manager staffed on that specific project, or an Admin or System Admin, may generate a status report.

Generating a status report runs in the background, the same as a scope check, and returns a job id immediately.

A status report covers a specific period. If no period is given, it defaults to since the last status report, or the last seven days if none exists yet.

A status report is based on the project's PRD, its calculated numbers (hours, blockers, requirements, reviews, feedback), and what was both planned and accomplished during the period.

Unlike the project summary, a status report considers what was planned as well as what was actually done, so the two can be compared.

Every time a status report is generated, a new one is saved. Past status reports are never overwritten or deleted.

Anyone who can view a project summary can also view its status report history, in the same way.

A status report's numbers always match the project's own calculated report for the same period. They are never calculated a second, different way.

# Database Schema

| // \---------------------------------------------------------------------------// AI integration// \---------------------------------------------------------------------------enum AiJobType {CHECK\_SCOPEGENERATE\_STATUS\_REPORT}enum AiJobStatus {QUEUEDPROCESSINGCOMPLETEDFAILED}model AiJob {id String @id @default(uuid())type AiJobTypestatus AiJobStatus @default(QUEUED)projectId String?project Project? @relation(fields: \[projectId\], references: \[id\])requestedById String?requestedBy User? @relation(fields: \[requestedById\], references: \[id\])input Json // whatever the job needs: period, requirementId, etc.resultRefId String? // id of whatever the job producederrorMessage String?startedAt DateTime?finishedAt DateTime?createdAt DateTime @default(now())@@index(\[projectId\])@@index(\[type, status\])}enum AiTemplateKind {PROJECT\_SUMMARYSTATUS\_REPORT}model AiTemplate {id String @id @default(uuid())kind AiTemplateKindname Stringcontent String // the section outline Claude is told to followisDefault Boolean @default(false) // only one per kind at a timecreatedById StringcreatedBy User @relation(fields: \[createdById\], references: \[id\])createdAt DateTime @default(now())updatedAt DateTime @updatedAt@@index(\[kind\])}enum StatusReportType {STATUS\_UPDATE}model ProjectStatusReport {id String @id @default(uuid())projectId Stringproject Project @relation(fields: \[projectId\], references: \[id\])requestedById StringrequestedBy User @relation(fields: \[requestedById\], references: \[id\])reportType StatusReportType @default(STATUS\_UPDATE)content String // markdown, written by ClaudeperiodStart DateTimeperiodEnd DateTimemodel String // which Claude model produced thistemplateId String?template AiTemplate? @relation(fields: \[templateId\], references: \[id\])createdAt DateTime @default(now())@@index(\[projectId\])}// AdditionalRequirement.aiScopeAnalysis (from the project spec) is now// actually populated by Feature 1 above, stamped with a verdict, a// confidence, a written reason, a suggested extra-hours number, the model// used, and when it was checked. |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
