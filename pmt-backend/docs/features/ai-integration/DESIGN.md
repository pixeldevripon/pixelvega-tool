# AI Integration Design

Status: proposal, nothing implemented yet. This document exists so we can agree on the shape of the work before any code is written.

This version makes a deliberate call: build real retrieval (RAG, backed by Voyage embeddings and pgvector) and a real background job queue (BullMQ on Redis) from the start, rather than deferring both. Two reasons. First, real client requirement sets run 40 to 50 PDF pages routinely, and are sometimes a loose vision document rather than a structured spec, retrieval keeps the model looking at the passages that actually match what is being asked instead of trusting it to find the right thread in a long, sometimes meandering document. Second, this is a legitimate chance to have a working example of both patterns in this codebase, which has value on its own even where the strict page count would not yet force the issue.

## What this covers

Four things, using the Claude API:

1. AI PRD generation. Feed it the project's uploaded documents plus a sample PRD, get a first draft PRD back in that style. Ask for specific changes afterward and have it update automatically. Manual editing still possible on top.
2. An AI project scope checker, so a new Additional Requirement can be checked against the project's own documents to see if it is in scope or out of scope.
3. A project summary generator, based on the PRD plus the daily plan and wrap up entries submitted so far.
4. Report generation, a fuller status report that a Project Manager can generate and hand to a client or to leadership.

Everything below is designed to sit inside the existing codebase the way Slack integration does: a small generic wrapper module for talking to Claude, and the actual feature logic living inside `ProjectsModule` because it needs `ProjectActivityService` and the `ProjectMember` staffing checks that already live there. Two new pieces of infrastructure join the stack for this: Redis (for the job queue) and Voyage plus pgvector (for retrieval), both new to this app, neither replacing anything that already exists.

## Why these four features fit together

All four read from the same two places: a project's documents (mainly the PRD, and the REQUIREMENT type documents underneath it) and its daily work history (`DailyProjectEntry.plan` / `accomplishments`, plus blockers, time tracking, and client feedback for the fuller report). Retrieval is what makes reading "a project's documents" scale to however long and however loosely organized those documents actually are, rather than depending on them staying short and tidy.

## New module: `src/modules/ai/`

A thin module, not `@Global()`, imported by `ProjectsModule` only, mirroring how `SlackModule` is wired today. It now carries the retrieval pipeline as well as the Claude wrapper, since both are used by every one of the four features.

```
src/modules/ai/
  ai.module.ts
  claude.service.ts        // wraps @anthropic-ai/sdk
  voyage.service.ts         // wraps voyageai, embeds text
  chunking.util.ts           // splits document text into overlapping chunks
  retrieval.service.ts       // embeds a query, runs the pgvector similarity search, returns top chunks
  pdf-text.util.ts            // extracts text from an uploaded FILE format PDF before it can be chunked
```

`ClaudeService` exposes:

* `generateText(params)` for a plain prose response (PRD generation, project summary, reports).
* `generateStructured(params, schema)` for a response that must parse as JSON against a schema (the scope checker's verdict).

`VoyageAIClient` from the official `voyageai` package (`npm i voyageai`) wraps Voyage's embedding endpoint the same shape:

```ts
const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
const result = await client.embed({ input: [chunkText], model: "voyage-4-lite", outputDimension: 1024 });
```

Same constructor timing rule as `ClaudeService`: build the client inside the provider's constructor, not at the top of the file, to avoid the module load order trap this project already documented for `auth.instance.ts` and `cloudinary.service.ts`.

`SlackService`'s "never throws" rule still applies to nothing here directly, but the same spirit carries over to `ScopeCheckService` specifically, since it is still best effort. `ClaudeService` and `VoyageAIClient` calls inside a queued job (see Background jobs below) fail the job, not the original HTTP request, since by the time either runs the request that triggered them has already returned.

New env vars: `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `REDIS_URL`, all added to `.env.example`.

New dependencies: `@anthropic-ai/sdk`, `voyageai`, `bullmq`, `@nestjs/bullmq`, `pdf-parse` (to extract text from an uploaded PDF before it can be chunked, needed for FILE format REQUIREMENT documents specifically, TEXT format documents already have their content as a string).

## Retrieval pipeline (RAG)

### Why this exists

A 40 to 50 page PDF is common for a real client requirement set, and sometimes the content is closer to a loose vision document than a structured spec. Retrieval means embedding the actual question being asked right now (a scope check description, a revision instruction, "what changed recently") and pulling back only the passages that are actually close to that question, rather than handing the model the entire document every time and trusting it to find the right thread itself. This is the standard shape of RAG: chunk, embed, store, then retrieve by similarity at request time.

The saving is not spread evenly across the four features, and it is worth being precise about where it actually shows up rather than assuming it helps everywhere equally. Take a 45 page project (about 31,500 tokens of source text at roughly 700 tokens a page):

* **The scope checker is where this pays off, and it pays off a lot.** It is called once per Additional Requirement, and without retrieval it re reads the entire PRD plus REQUIREMENT documents from scratch every single time. Sending all 31,500 tokens to Haiku 4.5 ($1 per 1M input tokens) costs about $0.032 per call. Retrieving 8 chunks instead (about 4,000 tokens) costs about $0.004 per call, roughly an 8x reduction. The one cost that does not disappear is chunking and embedding the source documents in the first place (Voyage 4 Lite at $0.02 per 1M tokens, about $0.0006 for that same 31,500 token document), but that happens once, on upload or edit, not once per scope check. Ten scope checks against the same documents costs about $0.32 without retrieval, versus about $0.04 plus the one time $0.0006 with it. The more Additional Requirements a project accumulates against the same PRD, the better that ratio gets, since the one time embedding cost is spread across more and more cheap lookups instead of paying the full read cost again on every single call.
* **PRD generation's first draft does not benefit**, and still needs the full source documents, since it is writing something new from everything available, not answering a narrow question. Cost is the same with or without retrieval here.
* **PRD revision was already cheap before retrieval**, since this design never resent the full source documents on a revision, only the current PRD text plus the instruction. Retrieval adds a small number of tokens here (the chunks relevant to the specific instruction), which makes the revision more targeted, but it is not a saving against that particular step, since the thing it is replacing was already lean.

So the case for retrieval rests most heavily on the scope checker's usage pattern, the same body of documents queried repeatedly with small, different questions, not on page count by itself.

### Chunking and embedding

Whenever a `ProjectDocument`'s content is created or changes (a new upload, a PRD generation or revision, a manual text edit), its text is split into overlapping chunks (roughly 500 tokens each, with a small overlap so a sentence spanning a chunk boundary is not lost entirely from either side), and each chunk is embedded through Voyage 4 Lite at 1024 dimensions, a middle ground Voyage's own model supports directly between their smaller (256, 512) and larger (2048) options.

A FILE format document (an uploaded PDF, for example) has its text extracted first via `pdf-parse` before it can be chunked. A TEXT format document (already a plain string in `textContent`) skips that step.

This work happens as a background job, not inline on the upload or edit request, see Background jobs below.

### Storage

pgvector is available on every Neon plan already, no separate database or paid add on, it only needs `CREATE EXTENSION IF NOT EXISTS vector;` run once. A new model holds the chunks:

```prisma
model DocumentChunk {
  id         String   @id @default(uuid())
  documentId String
  document   ProjectDocument @relation(fields: [documentId], references: [id])
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id])

  chunkIndex Int      // order within the document, so retrieved chunks can be shown in original context
  content    String   // the chunk's raw text
  tokenCount Int

  // embedding vector(1024), added by hand written SQL migration below,
  // Prisma has no first class vector type yet.

  createdAt DateTime @default(now())

  @@index([projectId])
  @@index([documentId])
}
```

Prisma 7 does not have a native vector column type, so the embedding column itself is added in the hand written migration SQL directly, and modeled in `schema.prisma` with `Unsupported("vector(1024)")` so Prisma Client still knows the column exists without trying to generate a typed field for it:

```prisma
embedding Unsupported("vector(1024)")?
```

```sql
-- prisma/migrations/<timestamp>_add_document_chunks/migration.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "DocumentChunk" (
  -- ...the columns above...
  "embedding" vector(1024)
);

CREATE INDEX "DocumentChunk_embedding_idx"
  ON "DocumentChunk" USING hnsw ("embedding" vector_cosine_ops);
```

The HNSW index is what keeps a similarity search fast as chunk count grows, it is the standard index type pgvector recommends for cosine similarity search today.

### Retrieval

Because Prisma Client cannot express a vector similarity search through its normal query builder, `RetrievalService` uses `$queryRaw` with pgvector's `<=>` cosine distance operator:

```ts
const rows = await this.prisma.$queryRaw<{ id: string; content: string; distance: number }[]>`
  SELECT id, content, embedding <=> ${queryEmbedding}::vector AS distance
  FROM "DocumentChunk"
  WHERE "projectId" = ${projectId}
  ORDER BY distance ASC
  LIMIT ${topK}
`;
```

`queryEmbedding` here is the embedding of a short, request specific query string, not of a whole document. What that query string is differs by feature:

* **Scope checker**: the new Additional Requirement's own description.
* **PRD revision**: the user's instruction (for example "add a section on mobile responsiveness").
* **Project summary and report**: a fixed synthetic query along the lines of "current status, recent progress, blockers, and anything that looks like a deviation from the original plan."

`topK` (how many chunks come back) starts at 8, worth tuning once real usage exists.

PRD generation's very first turn, `INITIAL`, is the one exception that keeps direct inclusion of full source documents rather than retrieval. That call is synthesizing a whole new document from source material, not answering a narrow question, so it needs breadth, not a focused slice. Every other call in this feature set (revision, scope check, summary, report) is answering something narrower and benefits from retrieval instead.

### Keeping the index correct

When a document's content changes (a PRD revision, a manual edit, a document being soft deleted), its existing `DocumentChunk` rows for that document are deleted before the new ones are written. Otherwise a similarity search can surface a chunk of text that no longer exists on the live document, and answer a scope check or a summary from something that was already replaced. This re chunk step runs inside the same background job that did the original chunking, described next.

## Background jobs (BullMQ + Redis)

### Why this exists

PRD generation and report generation can both run long enough (tens of seconds) that holding an HTTP request open for the full duration is not the friendliest shape, and document chunking plus embedding should never block the request that uploaded or edited a document in the first place. A real queue, with retry and backoff already built in rather than hand rolled, is the standard answer to both, and this is a good, contained place to build a real one.

### Setup

`bullmq` plus `@nestjs/bullmq`, against a Redis instance (`REDIS_URL`). One queue, `ai-jobs`, registered once in `AiModule` via `BullModule.registerQueue({ name: 'ai-jobs' })`, with a single `@Processor('ai-jobs')` class dispatching on job type:

```prisma
enum AiJobType {
  EMBED_DOCUMENT
  GENERATE_PRD
  REVISE_PRD
  CHECK_SCOPE
  GENERATE_REPORT
}

enum AiJobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
}

model AiJob {
  id            String      @id @default(uuid())
  type          AiJobType
  status        AiJobStatus @default(QUEUED)
  projectId     String?
  project       Project?    @relation(fields: [projectId], references: [id])
  requestedById String?
  requestedBy   User?       @relation(fields: [requestedById], references: [id])

  input        Json     // whatever the job needs: documentId, instruction, period, requirementId, etc.
  resultRefId  String?   // id of the row the job produced, a ProjectDocument, ProjectAiReport, or AdditionalRequirement id
  errorMessage String?

  startedAt  DateTime?
  finishedAt DateTime?
  createdAt  DateTime  @default(now())

  @@index([projectId])
  @@index([type, status])
}
```

An `AiJob` row is created at the moment a job is enqueued (`status: QUEUED`), and updated by the processor to `PROCESSING`, then `COMPLETED` or `FAILED`, with `resultRefId` pointing at whatever the job actually produced. This is the thing a client polls, `bullmq`'s own job object is not exposed outside the backend.

### What becomes asynchronous

* `POST /projects/:projectId/prd/generate` enqueues a `GENERATE_PRD` job and returns `202 Accepted` with `{ jobId }`, instead of returning the finished PRD in the same response.
* `PATCH /projects/:projectId/prd/:documentId/revise` enqueues `REVISE_PRD` the same way.
* `AdditionalRequirementsService.create()` enqueues `CHECK_SCOPE` instead of calling Claude inline. The Additional Requirement itself is still created and returned immediately either way, `aiScopeAnalysis` simply fills in a short time later once the job finishes, the same eventually consistent, best effort spirit as before, now genuinely running out of process instead of an unawaited promise in the same request.
* `POST /projects/:projectId/ai/reports` enqueues `GENERATE_REPORT` the same way as PRD generation.
* Document chunking and embedding (`EMBED_DOCUMENT`) is enqueued internally by `ProjectDocumentsService` and by the PRD generation/revision flow, never exposed as its own route.

New endpoint, generic across job types since a job is not necessarily project scoped from the caller's point of view (a client is usually just polling one specific job it already knows the id of):

* `GET /ai-jobs/:id`. Returns `{ id, type, status, resultRefId, errorMessage }`. Access is checked against whatever the underlying feature would have required (a PM checking a `GENERATE_PRD` job needs the same project staffing check `POST .../prd/generate` itself required), not a blanket rule.

### What stays synchronous

The project summary (`GET /projects/:projectId/ai/summary`) is a quick read by design, meant to answer "how is this going" without a polling round trip, and stays a plain synchronous call. It still benefits from retrieval, retrieval and queuing are independent decisions, this is retrieval without a queue.

### Failure handling

BullMQ's own retry and exponential backoff configuration (attempts, backoff type and delay) is used rather than hand rolled retry logic, configured per job type since a transient Claude API error and a malformed PDF that will never parse should not be retried the same number of times. A job that exhausts its retries lands in `FAILED` with `errorMessage` set, visible through `GET /ai-jobs/:id`.

## Templates: one consistent shape for PRD, summary, and report

Right now, without this, "a sample PRD" only exists as an ad hoc, one time choice a PM makes on each generation call, and the project summary and report have no editable shape at all, their section structure is baked straight into a hardcoded prompt. That is not something a PM can rely on for consistency across projects, and the only way to change what a summary or a report looks like would be a code change and a deploy. A small reference data model fixes both, managed the same way `LeaveType` and `Holiday` already are in this codebase: Admin writes, everyone reads.

```prisma
enum AiTemplateKind {
  PRD
  PROJECT_SUMMARY
  REPORT
}

model AiTemplate {
  id          String         @id @default(uuid())
  kind        AiTemplateKind
  name        String
  content     String          // an example PRD to imitate, or a structural outline for summary/report
  isDefault   Boolean         @default(false)
  createdById String
  createdBy   User            @relation(fields: [createdById], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([kind])
}
```

Exactly one `AiTemplate` per `kind` can be marked `isDefault: true` at a time, enforced with a partial unique index rather than a plain Prisma `@unique`, the same approach `BlockerReason` already uses to enforce name uniqueness over non deleted rows only:

```sql
CREATE UNIQUE INDEX "AiTemplate_kind_default_idx"
  ON "AiTemplate" ("kind") WHERE "isDefault" = true;
```

How each feature uses it:

* **PRD generation** no longer requires a PM to pick a sample document by hand every time. `POST .../prd/generate` falls back to the default `AiTemplate` of kind `PRD` whenever `sampleDocumentId` is omitted, so the common case, a PM who just wants a consistent, well structured PRD without thinking about which example to imitate, needs zero extra decisions. `sampleDocumentId` (still any existing `ProjectDocument`, from any project) stays available as a one time override for someone who deliberately wants to imitate a specific other project's PRD instead of the company default.
* **Project summary and report** gain a real, editable structure for the first time. The default `AiTemplate` of kind `PROJECT_SUMMARY` (or `REPORT`) has its content included directly in the system prompt as the required section structure, instead of that structure living as hardcoded prompt text inside `ProjectSummaryService`/`AiReportService`. Changing what a summary or a report looks like company wide becomes an Admin editing a template's text, not an engineering change.

`PrdGenerationTurn` and `ProjectAiReport` both gain a nullable `templateId`, so it is always possible to see which template shaped a given result, which matters once more than one template of a kind exists.

New reference data endpoints, matching the same "read everyone, write Admin only" pattern `LeaveType`/`Holiday` already use:

* `GET /ai-templates` (optional `?kind=PRD`), any staff role.
* `POST /ai-templates`, `PATCH /ai-templates/:id`, `DELETE /ai-templates/:id`, Admin and System Admin only.

One template per kind is enough for a first version: one default PRD shape, one default summary shape, one default report shape, applied company wide regardless of project. A natural extension once that has actually been used for a while: a template per `ProjectType`, since a WordPress project's PRD genuinely needs different sections than a mobile app's, and `ProjectType` tagging already exists on every project. That would only mean `AiTemplate` gaining an optional `projectType` filter, preferring a matching one before falling back to the untyped default, not a redesign. Worth flagging as a real possibility, not something to build before the single company wide template has proven itself.

## Feature 1: AI PRD generation

### Where it lives

New folder `src/modules/projects/ai/`, alongside the other per feature folders (`members/`, `documents/`, `time-tracking/`, and so on), registered in the existing `ProjectsModule`.

```
src/modules/projects/ai/
  dto/
    generate-prd.dto.ts
    revise-prd.dto.ts
  prd-generation.controller.ts   (Swagger tag "AI PRD Generation")
  prd-generation.service.ts
  prd-generation.processor.ts     (the @Processor for GENERATE_PRD and REVISE_PRD)
```

### How generation and revision work

A generated PRD is stored as an ordinary `ProjectDocument` (`type: PRD`, `format: TEXT`, content in `textContent`), the same table and shape a manually typed PRD already uses today. What is new is a small history table that records how the PRD got to its current text, since `ProjectDocument` itself has no built in versioning:

```prisma
enum PrdTurnType {
  INITIAL
  REVISION
}

model PrdGenerationTurn {
  id            String      @id @default(uuid())
  documentId    String
  document      ProjectDocument @relation(fields: [documentId], references: [id])
  projectId     String
  project       Project     @relation(fields: [projectId], references: [id])
  requestedById String
  requestedBy   User        @relation(fields: [requestedById], references: [id])

  turnType          PrdTurnType
  userInstruction   String?      // null for the INITIAL turn
  sourceDocumentIds Json          // which ProjectDocument ids fed this turn, or which chunk ids for a retrieval backed revision
  outputSnapshot    String        // full PRD text after this turn, so history is browsable even if the document is edited again later
  model             String
  inputTokens       Int
  outputTokens      Int

  createdAt DateTime @default(now())

  @@index([documentId])
  @@index([projectId])
}
```

Endpoints, nested under `projects/:projectId/prd`, Project Manager only (plus the usual automatic Admin and System Admin, and the PM must be staffed on that specific project, the same `assertManagesProject()` check `ProjectDocumentsService` already uses):

* `POST /projects/:projectId/prd/generate`. Body: which existing `ProjectDocument`s to use as source material (typically the REQUIREMENT type ones already uploaded), and optionally a `sampleDocumentId` pointing at a reference PRD to imitate the shape and tone of. When `sampleDocumentId` is omitted, the default `AiTemplate` of kind `PRD` is used instead (see Templates above), so a PM does not have to pick an example on every call. Enqueues `GENERATE_PRD`, returns `{ jobId }`. The job itself sends the full text of every named source document (direct inclusion, not retrieval, see Retrieval pipeline above for why this one call is the exception), creates a new `ProjectDocument`, a `PrdGenerationTurn` row with `turnType: INITIAL` and `templateId` set to whichever template guided it, and an `EMBED_DOCUMENT` job for the new document.
* `PATCH /projects/:projectId/prd/:documentId/revise`. Body: `{ instruction: string }`. Enqueues `REVISE_PRD`, returns `{ jobId }`. The job embeds the instruction, retrieves the most relevant chunks from the project's documents, sends those plus the PRD's current full text to Claude, overwrites `ProjectDocument.textContent`, appends a `PrdGenerationTurn` row with `turnType: REVISION`, and re chunks the now changed document.
* `GET /projects/:projectId/prd/:documentId/history`. Lists the `PrdGenerationTurn` rows oldest first, so a PM can see how the PRD evolved and who asked for what. Still a plain synchronous read.

Manual editing does not need a new endpoint at all. The existing `PATCH /projects/:projectId/documents/:id` already supports editing a TEXT format document, and a generated PRD is just a normal `ProjectDocument`. A hand edit is not recorded as a `PrdGenerationTurn`, only as the usual `DOCUMENT_UPDATED` project activity, but it does still trigger an `EMBED_DOCUMENT` job, since the document's text, and therefore its chunks, changed.

Because a revision now runs as a queued job rather than inline, the client warning about overwriting a recent manual edit (see Operational rules below) has to be checked before the job is enqueued, using the document's `updatedAt` against the last `PrdGenerationTurn`'s `createdAt`, not inside the job itself, so the warning can actually reach the person clicking the button rather than surfacing only after the rewrite already happened.

### The prompt

System prompt sets the assistant's role (an experienced product manager who writes clear, well structured PRDs) and the house format if we have one. For the `INITIAL` turn, the user turn carries the sample PRD if one was chosen, then every named source document's full text, then the project's own basic facts. For a `REVISION` turn, it carries the PRD's current full text, the retrieved chunks most relevant to the instruction, and the instruction itself. Both are explicit that Claude should only use the information given and should not invent requirements that are not present in the source material.

If the same sample PRD or house style prompt gets reused across many projects, mark that block with `cache_control: { type: "ephemeral" }` so repeated generations do not repay the same input tokens every time.

### Token cost of a revision

A revision call sends the system prompt, the PRD's current text, the handful of retrieved chunks relevant to the instruction, and the instruction itself, not every source document in full. That means asking for another change does not get more expensive as you go through more rounds of feedback, and retrieval keeps it from growing with how many source documents the project has accumulated either.

The part that does cost tokens on every revision is the output: Claude is asked to hand back the complete revised PRD, not a diff, so output tokens scale with the PRD's full length regardless of how small the requested change was. That is a deliberate choice for this first version, a full document is far simpler to store and display than a diff that has to be applied cleanly. If revision volume ever makes this worth optimizing, a diff based revision mode is the natural next step.

Because a full PRD can run to several thousand words, generation uses the SDK's streaming helper inside the job (`client.messages.stream(...)` then `.get_final_message()`), so a long response never risks the job's own execution timeout.

## Feature 2: AI scope checker

This wires up a column that already exists in the schema but was never connected. `AdditionalRequirement.aiScopeAnalysis` (a `Json?` column) has been sitting there with a comment saying it is "reserved for an automatic comparison of whether this falls in or out of scope against the project's existing requirement documents." This plan is exactly that comparison.

New file, no new controller for the check itself: `src/modules/projects/ai/scope-check.processor.ts`, the `CHECK_SCOPE` handler.

When `AdditionalRequirementsService.create()` inserts a new row, it enqueues a `CHECK_SCOPE` job rather than calling Claude directly. That job:

1. Embeds the new requirement's description as the query.
2. Retrieves the most relevant chunks from the project's PRD and REQUIREMENT type documents. If the project has neither, the job finishes immediately with `aiScopeAnalysis` left null and a reason, no Claude call is made at all, there is nothing to compare against.
3. Sends Claude a request using structured output (`output_config.format` with a JSON schema), asking for exactly three fields: `verdict` (`IN_SCOPE`, `OUT_OF_SCOPE`, or `UNCLEAR`), `confidence` (0 to 1), and `reasoning` (two to four sentences).
4. Writes the whole object into `aiScopeAnalysis`, stamped with the model name and a timestamp.

This is still best effort: a failed job leaves `aiScopeAnalysis` null and the requirement stands exactly as it was created. Nothing about requirement creation depends on this succeeding, and the requirement itself is never held up waiting on the job, since it was already created and returned before the job was even picked up.

Critically, this does not change the approval flow at all. `CLAUDE.md` is explicit that every Additional Requirement needs an explicit PM approve or reject regardless of scope, since there is no scope flag to condition on. That stays true. `aiScopeAnalysis` is advisory context a PM sees on the requirement once the job has finished, not an automatic gate. The PM still makes the call.

## Feature 3: project summary

Answers "how is this project doing, based on the PRD and everything reported so far."

New endpoint: `GET /projects/:projectId/ai/summary`, synchronous, no queue (see Background jobs above for why). Same read scoping as the rest of this module: Project Manager, Admin, and System Admin can call it on any project; Developer and Designer only if they are an active member of that specific project; Client is excluded.

The service embeds a fixed query ("current status, recent progress, blockers, deviations from plan"), retrieves the most relevant PRD chunks, and combines those with the most recent wrap up entries (`DailyProjectEntry.accomplishments`) across every contributor, open Blockers, and the project's own core fields. One plain prose call to Claude, following the default `AiTemplate` of kind `PROJECT_SUMMARY` (see Templates above) for the required section structure, so every summary reads the same shape regardless of which project or which PM triggered it.

The response is not stored, it is generated fresh each call and returned as `{ summary, generatedAt, basedOn: { prdDocumentId, chunksUsed, wrapUpEntryCount, dateRange } }` so whoever reads it can see exactly what evidence it was built from.

This feature depends entirely on wrap up entries actually existing (see Open questions below). A project with no recent wrap ups will get a thin, low value summary, and it will not look obviously wrong, it will just look quiet.

## Feature 4: report generation

A fuller, saved version of the same idea, meant to be handed to a client or to leadership rather than checked quickly, and asynchronous like PRD generation since it pulls the widest context of the four jobs.

```prisma
enum AiReportType {
  STATUS_UPDATE
}

model ProjectAiReport {
  id            String   @id @default(uuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id])
  requestedById String
  requestedBy   User     @relation(fields: [requestedById], references: [id])

  reportType  AiReportType @default(STATUS_UPDATE)
  content     String        // markdown
  periodStart DateTime
  periodEnd   DateTime
  model       String

  createdAt DateTime @default(now())

  @@index([projectId])
}
```

`ProjectAiReport` is a separate table from `ProjectDocument` on purpose. A report has its own metadata (a period, a report type) that does not belong on the generic document model. Like `ProjectMember`, `TimeEntry`, and every other history bearing model in this module, a report is append only: regenerating a report for the same period creates a new row rather than overwriting the last one.

Endpoints, nested under `projects/:projectId/ai/reports`, Project Manager (staffed on that project) plus the automatic Admin and System Admin:

* `POST /projects/:projectId/ai/reports`, body optionally `{ periodStart, periodEnd }` (defaults to since the last report, or the last seven days if there has never been one). Enqueues `GENERATE_REPORT`, returns `{ jobId }`. The job retrieves the relevant PRD chunks the same way the summary does, plus time tracking totals for the period, client feedback and internal review history, and open or resolved blockers, follows the default `AiTemplate` of kind `REPORT` for its section structure, and stores the result as a new row with `templateId` set.
* `GET /projects/:projectId/ai/reports`, lists history, newest first. Synchronous read.

Both the report's `content` and the PRD's `textContent` are stored as plain text in Postgres, nothing in this feature set requires uploading a file to Cloudinary. If a downloadable PDF or DOCX export of a report or PRD for handing to a client outside the app turns out to be wanted, that is a distinct, separate feature, not something this plan assumes.

A natural next step once this is working is to post the report to the project's Slack channel using the existing `SlackService.postMessage`. Not part of this first version, just worth flagging since the wiring already exists.

## New Prisma models and enum changes, summarized

* New model `DocumentChunk`, holding the retrieval index (chunk text plus a pgvector embedding column added by hand written SQL).
* New model `AiJob`, new enums `AiJobType` and `AiJobStatus`, tracking every queued piece of work across all four features.
* New model `AiTemplate`, new enum `AiTemplateKind` (`PRD`, `PROJECT_SUMMARY`, `REPORT`), reference data giving PRD generation, the summary, and the report a consistent, Admin editable shape.
* New model `PrdGenerationTurn`, new enum `PrdTurnType` (`INITIAL`, `REVISION`), plus a nullable `templateId`.
* New model `ProjectAiReport`, new enum `AiReportType` (`STATUS_UPDATE` only for now), plus a nullable `templateId`.
* Extend `ProjectActivityType` with `PRD_GENERATED`, `PRD_REVISED`, and `AI_REPORT_GENERATED`.
* `AdditionalRequirement.aiScopeAnalysis` already exists, this plan only adds the code path that writes to it.
* The `vector` Postgres extension, enabled once via `CREATE EXTENSION IF NOT EXISTS vector;` in the same hand written migration that creates `DocumentChunk`.

Since this environment cannot run `prisma migrate dev` (it needs an interactive terminal), the actual migrations would be hand written under `prisma/migrations/<timestamp>_<name>/` and applied with `prisma migrate deploy`, per the existing workflow documented for this repository.

## Model choice

Current Claude lineup and per million token pricing: Opus 5 is $5 input / $25 output, Sonnet 5 is $2 input / $10 output as an introductory rate through the end of August this year, stepping up to $3 / $15 after that, and Haiku 4.5 is $1 input / $5 output. Any monthly cost estimate built while the Sonnet 5 introductory rate is active should budget for roughly 50% more starting the following month.

The scope checker is a bounded classification, in scope, out of scope, or unclear, with a short reasoning string, retrieval already keeps its input small regardless of project size. Haiku 4.5 with structured output is the right fit, and it is also the highest volume job of the four.

PRD generation is the one tier decision genuinely still open. It is real composition, not classification, and the finished document may go in front of a client, against low volume (tens of PRDs a month), so the dollar gap between a mid tier and a top tier model is small in absolute terms. The deciding question is whether a mid tier model's writing is good enough to hand over with little to no PM rewriting, a quality question worth actually testing before picking Sonnet 5 or Opus 5.

The project summary and the report should be treated as at least as demanding as each other, not the report as the lighter of the two, since the report reads a superset of what the summary reads.

Two small technical notes:

* Structured output is well supported across Opus 5, Sonnet 5, and Haiku 4.5.
* Prompt caching's minimum cacheable prefix is 512 tokens, worth using on the house style prompt and sample PRD wherever they repeat across calls.

Voyage 4 Lite's own pricing, for reference: $0.02 per 1M tokens embedded, 32,000 max input tokens per call, and the first 200 million tokens per account are free, which likely covers this app's volume outright.

## Operational rules we should not skip

1. **Warn before a revision could overwrite a recent manual edit.** Checked before the `REVISE_PRD` job is enqueued, not inside the job.
2. **Delete a document's old chunks the moment its content changes or the document is removed**, before writing new ones. Otherwise retrieval keeps answering from text that no longer exists on the project.
3. **Refuse the scope check outright when a project has no PRD or REQUIREMENT documents at all**, no Claude call made.
4. **Test a prompt against a small set of real projects with known, agreed on answers before switching it on**, and before switching a materially changed version of it on later. Five real projects is a reasonable starting bar.

## Cost controls

Two things belong in the first version:

* Prompt caching turned on wherever a large, repeated block exists.
* A hard monthly spend threshold with an alert, checked against actual Anthropic and Voyage usage/billing, not estimated from request counts. Once code exists that makes real paid calls, a cap is not optional polish.

## Roles summary

| Endpoint | Who can call it |
|---|---|
| `POST /projects/:id/prd/generate` | Project Manager (staffed on this project), Admin, System Admin |
| `PATCH /projects/:id/prd/:documentId/revise` | Same as above |
| `GET /projects/:id/prd/:documentId/history` | Same read scoping as documents generally: PM/Admin/System Admin company wide, staffed Developer/Designer on this project |
| `GET /ai-jobs/:id` | Whatever the underlying job's own feature requires |
| Additional Requirement scope check | Not a route, `CHECK_SCOPE` runs automatically inside `AdditionalRequirementsService.create()` |
| `GET /projects/:id/ai/summary` | PM/Admin/System Admin any project, staffed Developer/Designer, Client excluded |
| `POST /projects/:id/ai/reports` | Project Manager (staffed on this project), Admin, System Admin |
| `GET /projects/:id/ai/reports` | Same read scoping as the summary endpoint |
| `GET /ai-templates` | Any staff role (ADMIN/PROJECT_MANAGER/DEVELOPER/DESIGNER), same as other reference data |
| `POST` / `PATCH` / `DELETE /ai-templates` | Admin, System Admin only |

## Suggested build order

1. **Infrastructure first.** Redis plus `bullmq`/`@nestjs/bullmq` wired up with one working job type end to end, and the `vector` extension plus `DocumentChunk` plus a working chunk, embed, retrieve round trip against one real document. Nothing feature specific yet, just proving both new pieces of infrastructure work in this app before building on top of them.
2. **Write the first default templates.** One real `AiTemplate` per kind (`PRD`, `PROJECT_SUMMARY`, `REPORT`), each marked `isDefault: true`, written and reviewed by hand before anything generates against them. Every PM's first experience of "just click Generate" depends on this content being good, not placeholder text.
3. **Scope checker.** Smallest feature, exercises the full path end to end: enqueue, retrieve, structured output, write back to an existing column.
4. **PRD generation and revision.** The centerpiece, and everything else reads the PRD it produces. Run the evaluation step above before deciding the PRD model tier.
5. **Project summary.** Read only, synchronous, reuses the retrieval and data gathering the other features already built.
6. **Report generation.** Builds directly on the summary work, adds the persisted history table and the async job path.

## Open questions for you to decide before implementation starts

1. **Who writes the first default templates, and what do they actually say.** Resolved in shape (see Templates above, `AiTemplate` with one `isDefault` row per kind), but the content itself is still an open, real piece of work, not a technical decision. A bad or thin default PRD template produces bad or thin PRDs for every PM who does not think to override it, so this deserves real drafting and review before Feature 1 ships, not placeholder text written to satisfy the schema.
2. **Model tier for PRD generation**, Opus 5 or Sonnet 5. Should be settled by testing actual output quality against real projects, not by the small cost gap between the two.
3. **Should a manual hand edit to a PRD also get logged as a `PrdGenerationTurn`** (a third `turnType`, say `MANUAL_EDIT`)?
4. **How daily wrap up entries actually get submitted reliably**, since the project summary and report are only as good as that data, and a skipped wrap up fails quietly rather than with an error.
5. **Whether a report or PRD ever needs to leave the app as a downloadable file** (PDF, DOCX) for sharing outside the system. Nothing here needs file storage as designed, an export feature would be a distinct addition.
6. **Redis hosting.** A managed Redis instance (Upstash, Redis Cloud, or similar) needs to exist somewhere `REDIS_URL` can point at, the same way `DATABASE_URL` already points at Neon. Worth deciding where that runs before the queue module is wired up.
7. **Whether templates should ever vary by `ProjectType`** (a WordPress PRD template looking different from a mobile app one), covered above under Templates as a natural but deliberately deferred extension.
