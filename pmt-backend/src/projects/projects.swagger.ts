import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import {
  conflict,
  gatedErrors,
  notFound,
  projectScopedErrors,
} from '@/common/swagger/error-sets';
import {
  ClientProjectResponseDto,
  PaginatedProjectsResponseDto,
  ProjectActivityResponseDto,
  ProjectResponseDto,
} from '@/projects/dto/project.dto';

/** Documentation for the core Project entity. */

const idParam = ApiParam({ name: 'id', description: 'The project id' });

const archivedQuery = ApiQuery({
  name: 'archived',
  required: false,
  type: Boolean,
  description:
    'Archived projects are excluded by default. Pass true for a dedicated archive view, ' +
    'which returns only archived projects rather than a mix of both.',
});

export const ApiCreateProjectDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a project',
      description:
        'Always created in PLANNING. Requires at least one project type tag, because a ' +
        'project can be several types at once (WordPress plus SEO, say), which is why ' +
        'types are a join table rather than a column. A PROJECT_MANAGER caller is ' +
        'automatically staffed as an active PM on their own new project, or they would ' +
        'be locked out of editing it the moment they created it. An admin is not, since ' +
        'they already have unscoped access.',
    }),
    ApiResponse({
      status: 201,
      description: 'The created project',
      type: ProjectResponseDto,
    }),
    ...gatedErrors,
    notFound('Client not found'),
  );

export const ApiListProjectsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List projects',
      description:
        'Paginated, newest first. projectTypes matches ANY of the given types rather ' +
        'than all of them. search matches the project name, case insensitive and ' +
        'anywhere in it, for finding one project quickly at scale.',
    }),
    archivedQuery,
    ApiQuery({ name: 'search', required: false }),
    ApiResponse({
      status: 200,
      description: 'Paginated projects',
      type: PaginatedProjectsResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiListOwnProjectsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List the caller's own projects",
      description:
        'Scope and field set both branch on role. A CLIENT gets projects where they are ' +
        'the client, in the reduced client view, with no internal fields. Staff get ' +
        'projects they are actively staffed on, ordered for a dashboard: active status ' +
        'first, then priority, then deadline, then planned start, with undated projects ' +
        'last. For a DEVELOPER or DESIGNER the response also carries overloaded, true ' +
        'once their active project count passes the recommended maximum.',
    }),
    archivedQuery,
    ApiResponse({
      status: 200,
      description: 'Paginated, scoped to the caller',
      type: PaginatedProjectsResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiListUserProjectsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List a specific user's projects",
      description:
        'The workload lookup a PM uses when deciding who to staff. Same scoping and ' +
        "dashboard ordering as the caller's own list, for a target userId instead.",
    }),
    ApiParam({ name: 'userId', description: 'The user id' }),
    archivedQuery,
    ApiResponse({
      status: 200,
      description: 'Paginated, scoped to the target user',
      type: PaginatedProjectsResponseDto,
    }),
    ...gatedErrors,
    notFound('User not found'),
  );

export const ApiGetProjectDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get a project by id',
      description:
        'One handler, three audiences. A CLIENT gets a reduced field set for their own ' +
        'project only, with priority, rush reason, hold reason, cancellation reason and ' +
        'staffing all withheld. A DEVELOPER or DESIGNER must be an active member. A PM ' +
        'or admin may read any project. remainingHours is computed on the way out from ' +
        'estimated minus actual, never stored, so it cannot drift.',
    }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'The project, in the projection for this caller',
      type: ProjectResponseDto,
    }),
    ApiExtraModels(ClientProjectResponseDto),
    ...projectScopedErrors,
  );

export const ApiGetProjectActivityDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Get a project's activity timeline",
      description:
        'Append only, written at meaningful points across the whole project domain: ' +
        'status and priority changes, staffing, documents, time, requirements, work ' +
        'reports, blockers, reviews and feedback. Internal, so a CLIENT is excluded.',
    }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'Paginated activity, newest first',
      type: [ProjectActivityResponseDto],
    }),
    ...projectScopedErrors,
  );

export const ApiUpdateProjectDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Update a project's details",
      description:
        'A PROJECT_MANAGER must be actively staffed as PM on this specific project; ' +
        'holding the role company wide is not enough. An admin bypasses that.',
    }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'The updated project',
      type: ProjectResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiUpdateProjectPriorityDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Change a project's priority",
      description:
        'rushReason is required when moving to URGENT or CRITICAL, and is cleared back ' +
        'to null when moving off them.',
    }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'The updated project',
      type: ProjectResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiUpdateEstimatedHoursDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Set a project's estimated hours",
      description:
        'Manually set. actualHours is separate and is recalculated from time entries, so ' +
        'the two never overwrite each other. Approved additional requirements and ' +
        'resolved blockers add onto this estimate rather than replacing it.',
    }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'The updated project',
      type: ProjectResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiConnectProjectSlackDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Connect this project's Slack channel",
      description:
        'A backfill for a project that never got a channel, since creation only ever ' +
        'tries once and never retries. Omit slackChannelId to create a new channel, or ' +
        'pass one to link a channel made by hand, which is verified reachable first. ' +
        'Either way the CURRENT full active roster is invited, not whoever was staffed ' +
        'at creation time. 409 if a channel is already connected: there is no silent relink.',
    }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'The project, now with a channel',
      type: ProjectResponseDto,
    }),
    ...projectScopedErrors,
    conflict('This project already has a Slack channel'),
  );

export const ApiUpdateProjectTypesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Change a project's types",
      description:
        'REPLACE ALL, not a delta: send the complete desired set. The service diffs it ' +
        'against what is currently tagged and only writes and logs when something ' +
        'actually changed.',
    }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'The updated project',
      type: ProjectResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiUpdateProjectStatusDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Change a project's status",
      description:
        'Sequence is governed by a fixed transition table. Two moves are deliberately ' +
        'NOT reachable here: leaving INTERNAL_REVIEW, and leaving WAITING_FOR_FEEDBACK. ' +
        'Only the internal review and client feedback endpoints can make those, which is ' +
        'what guarantees a row always exists explaining how a project left either state. ' +
        'A reason is required for ON_HOLD and for CANCELLED. Only an admin may cancel; a ' +
        'DEVELOPER or DESIGNER may change status generally but not to ON_HOLD. Reopening ' +
        'a COMPLETED or CANCELLED project to READY_FOR_WORK is admin only and refused ' +
        'once the project is archived, where restore is the way back.',
    }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'The updated project',
      type: ProjectResponseDto,
    }),
    ...projectScopedErrors,
    conflict('That transition is not allowed from the current status'),
  );

export const ApiArchiveProjectDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Archive a project',
      description:
        'A flag layered on top of status, not part of the state machine: it sets ' +
        'archivedAt and does not touch status itself. Only a COMPLETED or CANCELLED ' +
        'project can be archived.',
    }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'The archived project',
      type: ProjectResponseDto,
    }),
    ...projectScopedErrors,
    conflict('Not completed or cancelled, or already archived'),
  );

export const ApiRestoreProjectDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Restore an archived project',
      description:
        'The only way back from archived. Clears archivedAt, completedAt and the ' +
        'cancellation reason, and always returns the project to READY_FOR_WORK whichever ' +
        'closed status it had. No time limit.',
    }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'The restored project',
      type: ProjectResponseDto,
    }),
    ...projectScopedErrors,
    conflict('This project is not archived'),
  );
