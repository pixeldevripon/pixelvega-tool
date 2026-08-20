import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  conflict,
  notFound,
  projectScopedErrors,
} from '@/common/swagger/error-sets';
import { InternalReviewResponseDto } from '@/projects/reviews/internal/dto/internal-review.dto';
import { ClientFeedbackResponseDto } from '@/projects/reviews/client/dto/client-feedback.dto';
import {
  AdditionalRequirementResponseDto,
  PaginatedAdditionalRequirementsResponseDto,
} from '@/projects/requirements/additional/dto/additional-requirement.dto';
import { QueuedJobResponseDto } from '@/ai/dto/ai.dto';

/**
 * Documentation for the three review gates InternalReviewsModule owns: the internal
 * review before a project goes to the client, the client's own feedback, and
 * the additional requirements that arrive outside the original scope.
 */

const projectIdParam = ApiParam({
  name: 'projectId',
  description: 'The project id',
});

// ── Internal review ──────────────────────────────────────────────────────────

export const ApiListInternalReviewsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List a project's internal review history",
      description:
        'Oldest round first. Append only: every decision is its own row, so the full ' +
        'back and forth survives. A CLIENT is excluded entirely, this is internal.',
    }),
    projectIdParam,
    ApiResponse({
      status: 200,
      description: 'Review rounds, oldest first',
      type: [InternalReviewResponseDto],
    }),
    ...projectScopedErrors,
  );

export const ApiSubmitInternalReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Submit an internal review decision',
      description:
        'The ONLY way a project leaves INTERNAL_REVIEW. The generic status endpoint ' +
        'deliberately cannot make either move, so a ProjectInternalReview row always ' +
        'exists to explain it. APPROVED sends the project to READY_FOR_CLIENT; ' +
        'CHANGES_REQUIRED sends it back to READY_FOR_WORK and requires comments, so ' +
        'the developer has something actionable.',
    }),
    projectIdParam,
    ApiResponse({
      status: 201,
      description: 'The recorded review',
      type: InternalReviewResponseDto,
    }),
    ...projectScopedErrors,
    conflict('The project is not currently in internal review'),
  );

// ── Client feedback ──────────────────────────────────────────────────────────

export const ApiListClientFeedbackDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List a project's client feedback history",
      description:
        'Oldest round first. Unlike internal review, a CLIENT can read this, for their ' +
        'own project only.',
    }),
    projectIdParam,
    ApiResponse({
      status: 200,
      description: 'Feedback rounds, oldest first',
      type: [ClientFeedbackResponseDto],
    }),
    ...projectScopedErrors,
  );

export const ApiSubmitClientFeedbackDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Submit a client feedback decision',
      description:
        'ONLY the first round moves the project: APPROVED completes it, ' +
        'CHANGES_REQUESTED sends it back to READY_FOR_WORK, and it requires the project ' +
        'to be WAITING_FOR_FEEDBACK. Every later round is commentary and never touches ' +
        'the status, so a developer already back in progress on the first decision is ' +
        'not interrupted. A PM may record feedback the client gave outside the system; ' +
        'recordedById then names the PM, and is null for a direct client submission.',
    }),
    projectIdParam,
    ApiResponse({
      status: 201,
      description: 'The recorded feedback',
      type: ClientFeedbackResponseDto,
    }),
    ...projectScopedErrors,
    conflict('Not waiting for feedback, or the project is already closed'),
  );

// ── Additional requirements ──────────────────────────────────────────────────

export const ApiListAdditionalRequirementsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List a project's additional requirements",
      description:
        'Work asked for outside the original scope, logged from wherever it arrived: ' +
        'email, a marketplace message, a phone call. Not client visible at all.',
    }),
    projectIdParam,
    ApiResponse({
      status: 200,
      description: 'Paginated requirements',
      type: PaginatedAdditionalRequirementsResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiGetAdditionalRequirementDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get one additional requirement' }),
    projectIdParam,
    ApiParam({ name: 'requirementId', description: 'The requirement id' }),
    ApiResponse({
      status: 200,
      description: 'The requirement',
      type: AdditionalRequirementResponseDto,
    }),
    ...projectScopedErrors,
    notFound('Additional requirement not found'),
  );

export const ApiCreateAdditionalRequirementDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Log an additional requirement',
      description:
        'Created PENDING_REVIEW. Every requirement needs an explicit PM decision.',
    }),
    projectIdParam,
    ApiResponse({
      status: 201,
      description: 'The logged requirement',
      type: AdditionalRequirementResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiReviewAdditionalRequirementDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Approve or reject an additional requirement',
      description:
        'Fires once: reviewing an already reviewed requirement is a 409. Approving is ' +
        'ADDITIVE, never an override. approvedAdditionalHours is added onto the ' +
        "project's current estimate, treating a null estimate as zero, and " +
        'deadlineExtensionDays is added onto the current deadline, extending from today ' +
        'when there is none. Both fields are rejected on a REJECTED decision.',
    }),
    projectIdParam,
    ApiParam({ name: 'requirementId', description: 'The requirement id' }),
    ApiResponse({
      status: 200,
      description: 'The reviewed requirement',
      type: AdditionalRequirementResponseDto,
    }),
    ...projectScopedErrors,
    notFound('Additional requirement not found'),
    conflict('Already reviewed'),
  );

export const ApiCheckRequirementScopeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Ask the model whether a requirement is in the original scope',
      description:
        'Queued: returns a jobId to poll at GET /ai/jobs/:jobId. Compares the requirement ' +
        "against the project's PRD and REQUIREMENT documents. Advisory only, and it " +
        'never gates approval: approvedAdditionalHours is still only ever set by a PM. ' +
        'A project with neither document still gets a result explaining why, rather ' +
        'than a bare null.',
    }),
    projectIdParam,
    ApiParam({ name: 'requirementId', description: 'The requirement id' }),
    ApiResponse({
      status: 202,
      description: 'The queued job id',
      type: QueuedJobResponseDto,
    }),
    ...projectScopedErrors,
    notFound('Additional requirement not found'),
  );
