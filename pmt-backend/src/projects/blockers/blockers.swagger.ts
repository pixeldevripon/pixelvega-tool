import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  commonErrors,
  conflict,
  gatedErrors,
  notFound,
  projectScopedErrors,
} from '@/common/swagger/error-sets';
import {
  BlockerReasonResponseDto,
  BlockerResponseDto,
  PaginatedBlockersResponseDto,
} from '@/projects/blockers/dto/blocker.dto';
import { BlockerDeadlineImpactDto } from '@/projects/blockers/dto/blocker.dto';
import { MessageResponseDto } from '@/users/dto/user.dto';

/**
 * Documentation for the three controllers BlockersModule owns: blockers
 * themselves (top level and project nested) and the reasons they are
 * categorised by.
 */

// ── Blockers ─────────────────────────────────────────────────────────────────

export const ApiReportBlockerDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Report a blocker',
      description:
        'Independent of any daily report: a blocker can be raised at any time and can ' +
        'span days. Created OPEN, with severity defaulting to MEDIUM and reasonId ' +
        'defaulting to the seeded "Unspecified" reason. The reporter must be actively ' +
        'staffed on the project, which an admin bypasses.',
    }),
    ApiResponse({
      status: 201,
      description: 'The reported blocker',
      type: BlockerResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiUpdateBlockerDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update a blocker: description, severity, status or assignee',
      description:
        'Status moves forward only, though OPEN may go straight to RESOLVED since a ' +
        'blocker can be fixed before anyone marks it in progress. Once RESOLVED it is ' +
        'permanently locked, with no admin override: it becomes an audit record. ' +
        'resolutionNotes is required exactly when resolving, and deadlineExtensionDays ' +
        'is an explicit decision made only at that point, never derived from how long ' +
        'the blocker was open. Editable by the original reporter or a PM on that project.',
    }),
    ApiParam({ name: 'blockerId', description: 'The blocker id' }),
    ApiResponse({
      status: 200,
      description: 'The updated blocker',
      type: BlockerResponseDto,
    }),
    ...gatedErrors,
    notFound('Blocker not found'),
    conflict('Already resolved, or the status move goes backwards'),
  );

export const ApiListBlockersDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List blockers across projects',
      description:
        'A PM or admin sees every project. A DEVELOPER or DESIGNER is filtered to ' +
        'projects they are actively staffed on. resolutionTime, daysOpen and ' +
        'causedDeadlineExtension are computed on read, never stored.',
    }),
    ApiResponse({
      status: 200,
      description: 'Paginated blockers',
      type: PaginatedBlockersResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiListProjectBlockersDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "One project's blockers, active and resolved",
      description:
        'The PM dashboard view. Same read scoping as the cross project list.',
    }),
    ApiParam({ name: 'projectId', description: 'The project id' }),
    ApiResponse({
      status: 200,
      description: 'Paginated blockers for this project',
      type: PaginatedBlockersResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiBlockerDeadlineImpactDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "How much this project's blockers have cost the schedule",
      description:
        'Sums resolution time and granted deadline extension days across the resolved ' +
        'blockers on this project.',
    }),
    ApiParam({ name: 'projectId', description: 'The project id' }),
    ApiResponse({
      status: 200,
      description: 'The impact summary',
      type: BlockerDeadlineImpactDto,
    }),
    ...projectScopedErrors,
  );

// ── Blocker reasons ──────────────────────────────────────────────────────────

export const ApiListBlockerReasonsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List blocker reasons',
      description:
        'PM managed reference data. Everyone who can report a blocker reads it. ' +
        'Soft deleted reasons are excluded.',
    }),
    ApiResponse({
      status: 200,
      description: 'Every active reason',
      type: [BlockerReasonResponseDto],
    }),
    ...commonErrors,
  );

export const ApiCreateBlockerReasonDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a blocker reason',
      description:
        'Name uniqueness is enforced by a partial index over non deleted rows, so a ' +
        'deleted reason frees its name for reuse. A duplicate answers 409 rather than ' +
        'a raw 500.',
    }),
    ApiResponse({
      status: 201,
      description: 'The created reason',
      type: BlockerReasonResponseDto,
    }),
    ...gatedErrors,
    conflict('A reason with that name already exists'),
  );

export const ApiUpdateBlockerReasonDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Rename a blocker reason',
      description:
        'The seeded "Unspecified" reason is protected and cannot be renamed.',
    }),
    ApiParam({ name: 'id', description: 'The reason id' }),
    ApiResponse({
      status: 200,
      description: 'The updated reason',
      type: BlockerReasonResponseDto,
    }),
    ...gatedErrors,
    notFound('Blocker reason not found'),
    conflict('That name is taken, or this reason is protected'),
  );

export const ApiDeleteBlockerReasonDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Delete a blocker reason',
      description:
        'Soft delete, so blockers already categorised by it keep their history. The ' +
        'seeded "Unspecified" reason is protected and cannot be deleted.',
    }),
    ApiParam({ name: 'id', description: 'The reason id' }),
    ApiResponse({
      status: 200,
      description: 'Deleted',
      type: MessageResponseDto,
    }),
    ...gatedErrors,
    notFound('Blocker reason not found'),
    conflict('This reason is protected'),
  );
