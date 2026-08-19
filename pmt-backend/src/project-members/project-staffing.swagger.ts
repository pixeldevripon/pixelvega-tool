import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  conflict,
  notFound,
  projectScopedErrors,
} from '@/common/swagger/error-sets';
import {
  AddProjectMemberResponseDto,
  PaginatedProjectMembersResponseDto,
  ProjectMemberResponseDto,
  ResyncMemberSlackResponseDto,
} from '@/project-members/dto/project-member.dto';

const projectIdParam = ApiParam({
  name: 'projectId',
  description: 'The project id',
});

export const ApiListProjectMembersDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List a project's team members",
      description:
        'Staffing is append only history: removing someone sets leftAt rather than ' +
        'deleting the row, so a person who rejoins later gets a brand new row and the ' +
        'past ones are untouched. Only rows with leftAt null count as active, and this ' +
        'returns those by default.',
    }),
    projectIdParam,
    ApiQuery({
      name: 'includeLeft',
      required: false,
      type: Boolean,
      description: 'Include members who have left, for the full history.',
    }),
    ApiResponse({
      status: 200,
      description: 'Project members',
      type: PaginatedProjectMembersResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiAddProjectMemberDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Add a team member to a project',
      description:
        "The ProjectRole must match the target's global Role one to one: Role is the " +
        'source of truth and ProjectRole only narrows it to the staffing context. The ' +
        'duplicate guard is scoped to (project, user, role), so a project may have any ' +
        'number of different developers at once, and only the same person holding the ' +
        'same role twice is blocked. Availability is informational and never blocks the ' +
        'add. Adding a developer or designer past the recommended active project count ' +
        'returns a workloadWarning string in the response rather than an error. If this ' +
        'add completes a viable team on a project still in PLANNING (an active PM plus ' +
        'an active developer or designer), the project moves automatically to SCHEDULED ' +
        'or READY_FOR_WORK.',
    }),
    projectIdParam,
    ApiResponse({
      status: 201,
      description: 'The staffed member, possibly with a workloadWarning',
      type: AddProjectMemberResponseDto,
    }),
    ...projectScopedErrors,
    notFound('User not found'),
    conflict('Already an active member with that role on this project'),
  );

export const ApiRemoveProjectMemberDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Remove a team member from a project',
      description:
        'Sets leftAt rather than deleting. The automatic transition out of PLANNING ' +
        'fires only on add, so a member leaving never reverts a project status.',
    }),
    projectIdParam,
    ApiParam({
      name: 'memberId',
      description: 'The ProjectMember row id, not the user id',
    }),
    ApiResponse({
      status: 200,
      description: 'The member row, now with leftAt set',
      type: ProjectMemberResponseDto,
    }),
    ...projectScopedErrors,
    notFound('Project member not found'),
    conflict('This member has already left'),
  );

export const ApiResyncMemberSlackDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Resync a member's Slack channel invite",
      description:
        'For the case where the member had no Slack account, or a different email, at ' +
        'the time they were staffed, so the automatic invite could never resolve. ' +
        'Answers 200 with invited false rather than an error when no Slack account ' +
        'resolves yet.',
    }),
    projectIdParam,
    ApiParam({ name: 'memberId', description: 'The ProjectMember row id' }),
    ApiResponse({
      status: 201,
      description: 'Whether an invite was sent',
      type: ResyncMemberSlackResponseDto,
    }),
    ...projectScopedErrors,
    notFound('Active project member not found'),
  );
