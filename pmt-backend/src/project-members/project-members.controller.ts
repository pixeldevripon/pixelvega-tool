import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ProjectMembersService } from './project-members.service';
import { AddProjectMemberDto } from '@/project-members/dto/add-project-member.dto';
import { QueryProjectMembersDto } from '@/project-members/dto/query-project-members.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

// Staffing (add/remove) stays limited to PM at the route level, but the
// service additionally requires the PROJECT_MANAGER caller to already be
// actively staffed as PM on this specific project (ADMIN/SYSTEM_ADMIN can
// staff any project regardless). Listing members is scoped differently; see
// findAll() below.

@ApiTags('Project Members')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/members')
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @ApiOperation({
    summary: "List a project's team members",
    description:
      'Active members only by default (leftAt IS NULL). Pass includeLeft=true for the full membership history. PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN can list any project; DEVELOPER/DESIGNER must be an active member of this project themselves.',
  })
  @ApiResponse({ status: 200, description: 'Paginated project members' })
  @ApiResponse({
    status: 403,
    description: 'DEVELOPER/DESIGNER not an active member of this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.VIEW_PROJECT_MEMBERS)
  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryProjectMembersDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectMembersService.findAll(
      projectId,
      query,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Add a team member to a project',
    description:
      "Always creates a new ProjectMember record. The role must match the user's global Role 1:1 (PROJECT_MANAGER/DEVELOPER/DESIGNER). PROJECT_MANAGER caller must be actively staffed as PM on this specific project already (ADMIN/SYSTEM_ADMIN can staff any project — this is how a project gets its first PM if the creator wasn't auto-staffed, or gets a second PM). If a DEVELOPER/DESIGNER would end up actively staffed on more than 3 non-terminal (not COMPLETED/CANCELLED) projects, the response includes a workloadWarning string — the assignment still succeeds, it's advisory only. PROJECT_MANAGER is exempt from that warning. Once the project has an active Project Manager and an active Developer or Designer, it auto-transitions out of PLANNING to SCHEDULED or READY_FOR_WORK based on plannedStartDate.",
  })
  @ApiResponse({
    status: 201,
    description:
      'Member added. May include a workloadWarning string if this pushed a DEVELOPER/DESIGNER over the recommended 3-active-project load.',
  })
  @ApiResponse({
    status: 400,
    description: "Role doesn't match the user's global Role",
  })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project or user not found' })
  @ApiResponse({
    status: 409,
    description: 'User already has an active membership in that role',
  })
  @RequirePermissions(Permission.MANAGE_PROJECT_MEMBERS)
  @Post()
  add(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectMembersService.add(projectId, dto, user.id, user.role);
  }

  @ApiOperation({
    summary: 'Remove a team member from a project',
    description:
      "Sets leftAt rather than deleting the record — membership history is preserved, and rejoining later creates a brand new record. Never changes the project's status on its own. PROJECT_MANAGER caller must be actively staffed as PM on this specific project.",
  })
  @ApiResponse({ status: 200, description: 'Member removed' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project or member not found' })
  @ApiResponse({ status: 409, description: 'Member has already left' })
  @RequirePermissions(Permission.MANAGE_PROJECT_MEMBERS)
  @Delete(':memberId')
  remove(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectMembersService.remove(
      projectId,
      memberId,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: "Resync a member's Slack channel invite",
    description:
      "Re-attempts inviting this active member to the project's Slack channel. Useful when they were added to the project before they had a Slack account (or joined Slack later, or under a different email) — the automatic invite only ever runs once, when they're first added, and never retries on its own. PROJECT_MANAGER caller must be actively staffed as PM on this specific project.",
  })
  @ApiResponse({
    status: 200,
    description:
      'Result of the resync attempt: { invited: boolean, message: string }. invited is false (not an error) if no Slack account could be resolved for this member yet.',
  })
  @ApiResponse({
    status: 400,
    description: 'This project has no Slack channel',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found, or no active member with that id',
  })
  @RequirePermissions(Permission.MANAGE_PROJECT_MEMBERS)
  @Post(':memberId/resync-slack')
  resyncSlack(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectMembersService.resyncSlackChannelMembership(
      projectId,
      memberId,
      user.id,
      user.role,
    );
  }
}
