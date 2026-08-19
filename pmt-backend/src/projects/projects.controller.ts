import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from '@/projects/dto/create-project.dto';
import { UpdateProjectDto } from '@/projects/dto/update-project.dto';
import { UpdateProjectPriorityDto } from '@/projects/dto/update-project-priority.dto';
import { UpdateProjectStatusDto } from '@/projects/dto/update-project-status.dto';
import { UpdateProjectTypesDto } from '@/projects/dto/update-project-types.dto';
import { UpdateEstimatedHoursDto } from '@/projects/dto/update-estimated-hours.dto';
import { ConnectSlackChannelDto } from '@/projects/dto/connect-slack-channel.dto';
import { QueryProjectsDto } from '@/projects/dto/query-projects.dto';
import { QueryMyProjectsDto } from '@/projects/dto/query-my-projects.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { RequireAnyPermission } from '@/auth/decorators/require-any-permission.decorator';

// Create, list all, and manage routes stay limited to staff (any
// PROJECT_MANAGER, plus ADMIN/SYSTEM_ADMIN automatically). Single project
// reads (findOne, findActivities, findMine) instead scope to the caller.
// See their individual @Roles and the service layer checks they call.

@ApiTags('Projects')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOperation({
    summary: 'Create a project',
    description:
      'Always created in PLANNING status. Requires at least one Project Type tag. If the caller is a PROJECT_MANAGER, they are automatically staffed as an active PM on the new project (ADMIN/SYSTEM_ADMIN are not, since they already have unscoped access).',
  })
  @ApiResponse({ status: 201, description: 'Project created' })
  @RequirePermissions(Permission.CREATE_PROJECT)
  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.create(dto, user.id, user.role);
  }

  @ApiOperation({
    summary: 'List projects',
    description:
      'Paginated, newest first. Filterable by status/priority/clientId/projectTypes (matches ANY of the given types). Archived projects are excluded by default, pass archived=true for a dedicated archive view (only archived projects, not a mix of both). search matches project name (case insensitive, contains), meant for finding one specific project quickly at scale.',
  })
  @ApiResponse({ status: 200, description: 'Paginated projects' })
  @RequirePermissions(Permission.VIEW_ALL_PROJECTS)
  @Get()
  findAll(@Query() query: QueryProjectsDto) {
    return this.projectsService.findAll(query);
  }

  @ApiOperation({
    summary: "List the caller's own projects",
    description:
      "For CLIENT, projects where they're the client (reduced field set — status only, no internal fields, archived is ignored). For PROJECT_MANAGER/DEVELOPER/DESIGNER, projects where they have an active ProjectMember row, ordered by active-status-first (READY_FOR_WORK/IN_PROGRESS), then Priority, then Deadline, then Planned Start Date. Archived projects are excluded by default, pass archived=true for a dedicated archive view. For DEVELOPER/DESIGNER callers, the response also includes an overloaded boolean (true once active project count exceeds the recommended 3) — always omitted for CLIENT/PROJECT_MANAGER. NOTE: must be declared before GET /:id so 'mine' isn't swallowed as an :id value.",
  })
  @ApiResponse({ status: 200, description: 'Paginated, scoped to the caller' })
  @RequirePermissions(Permission.VIEW_OWN_PROJECTS)
  @Get('mine')
  findMine(
    @Query() query: QueryMyProjectsDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.findMine(user.id, user.role, query);
  }

  @ApiOperation({
    summary: "List a specific user's projects",
    description:
      'Workload lookup for a PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN deciding who to assign — how many/which projects a Developer/Designer/PM is already staffed on. Same active-ProjectMember scoping and dashboard ordering as GET /projects/mine, just for a target userId instead of the caller. Archived projects are excluded by default, pass archived=true for a dedicated archive view. If the target is a DEVELOPER/DESIGNER, the response includes an overloaded boolean (true once their active project count exceeds the recommended 3) — omitted for a PROJECT_MANAGER target.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated, scoped to the target user. May include overloaded: true/false for a DEVELOPER/DESIGNER target.',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @RequirePermissions(Permission.VIEW_ALL_PROJECTS)
  @Get('users/:userId')
  findForUser(
    @Param('userId') userId: string,
    @Query() query: QueryMyProjectsDto,
  ) {
    return this.projectsService.findForUser(userId, query);
  }

  @ApiOperation({
    summary: 'Get a project by id',
    description:
      'CLIENT gets a reduced field set for their own project only. DEVELOPER/DESIGNER must be an active ProjectMember of this project. PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN can view any project.',
  })
  @ApiResponse({ status: 200, description: 'The project' })
  @ApiResponse({
    status: 403,
    description: 'DEVELOPER/DESIGNER not an active member of this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequireAnyPermission(
    Permission.VIEW_ALL_PROJECTS,
    Permission.VIEW_OWN_PROJECTS,
  )
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.findOne(id, user.id, user.role);
  }

  @ApiOperation({
    summary: "Get a project's activity timeline",
    description:
      'Paginated, newest first. Staff-only (no CLIENT) — DEVELOPER/DESIGNER must be an active ProjectMember of this project.',
  })
  @ApiResponse({ status: 200, description: 'Paginated project activities' })
  @ApiResponse({
    status: 403,
    description: 'DEVELOPER/DESIGNER not an active member of this project',
  })
  @RequirePermissions(Permission.VIEW_PROJECT_ACTIVITY)
  @Get(':id/activities')
  findActivities(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.findActivities(id, query, user.id, user.role);
  }

  @ApiOperation({
    summary: "Update a project's details",
    description:
      'PROJECT_MANAGER must be actively staffed as PM on this specific project (ADMIN/SYSTEM_ADMIN can edit any project).',
  })
  @ApiResponse({ status: 200, description: 'Project updated' })
  @ApiResponse({
    status: 403,
    description: 'Not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.EDIT_PROJECT)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.update(id, dto, user.id, user.role);
  }

  @ApiOperation({
    summary: "Change a project's priority",
    description:
      'rushReason is required when setting priority to URGENT or CRITICAL. PROJECT_MANAGER must be actively staffed as PM on this specific project.',
  })
  @ApiResponse({ status: 200, description: 'Priority updated' })
  @ApiResponse({ status: 400, description: 'Missing rushReason' })
  @ApiResponse({
    status: 403,
    description: 'Not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.CHANGE_PROJECT_PRIORITY)
  @Patch(':id/priority')
  updatePriority(
    @Param('id') id: string,
    @Body() dto: UpdateProjectPriorityDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.updatePriority(id, dto, user.id, user.role);
  }

  @ApiOperation({
    summary: "Set a project's estimated hours",
    description:
      'Manually set by PM/Admin today (AI-assisted estimation is future work) — can be increased or decreased freely. Enables remainingHours (estimatedHours - actualHours) on GET /projects/:id. PROJECT_MANAGER must be actively staffed as PM on this specific project.',
  })
  @ApiResponse({ status: 200, description: 'Estimated hours updated' })
  @ApiResponse({
    status: 403,
    description: 'Not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.MANAGE_ESTIMATED_HOURS)
  @Patch(':id/estimated-hours')
  updateEstimatedHours(
    @Param('id') id: string,
    @Body() dto: UpdateEstimatedHoursDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.updateEstimatedHours(
      id,
      dto,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: "Connect this project's Slack channel",
    description:
      "Backfills a Slack channel for a project that didn't get one at creation time (Slack misconfigured, or the one-time creation attempt failed silently). Pass slackChannelId to link a channel someone already created by hand in Slack (verified accessible to the bot first); omit it to have the system create a brand-new private channel. Either way, every currently active project member plus all admins are invited into it. PROJECT_MANAGER must be actively staffed as PM on this specific project.",
  })
  @ApiResponse({ status: 200, description: 'Slack channel connected' })
  @ApiResponse({
    status: 400,
    description:
      'The provided slackChannelId is not accessible to the bot, or channel creation failed',
  })
  @ApiResponse({
    status: 403,
    description: 'Not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({
    status: 409,
    description: 'Project already has a connected Slack channel',
  })
  @RequirePermissions(Permission.CONNECT_PROJECT_SLACK)
  @Patch(':id/slack-channel')
  connectSlackChannel(
    @Param('id') id: string,
    @Body() dto: ConnectSlackChannelDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.connectSlackChannel(
      id,
      dto,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: "Change a project's types",
    description:
      'Replace-all, not a delta — send the full desired set of Project Types. Types missing from the list are removed, new ones are added. PROJECT_MANAGER must be actively staffed as PM on this specific project.',
  })
  @ApiResponse({ status: 200, description: 'Types updated' })
  @ApiResponse({
    status: 403,
    description: 'Not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.MANAGE_PROJECT_TYPES)
  @Patch(':id/types')
  updateTypes(
    @Param('id') id: string,
    @Body() dto: UpdateProjectTypesDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.updateTypes(id, dto, user.id, user.role);
  }

  @ApiOperation({
    summary: "Change a project's status",
    description:
      'Validates the status transition graph and required reasons (ON_HOLD, CANCELLED). Only ADMIN/SYSTEM_ADMIN can move a project to CANCELLED. Only PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN can move a project to ON_HOLD, DEVELOPER/DESIGNER cannot. COMPLETED/CANCELLED to READY_FOR_WORK is a same day undo for a mistake, ADMIN/SYSTEM_ADMIN only, and only while the project has not been archived yet (use PATCH /projects/:id/restore instead once archived). PROJECT_MANAGER must be actively staffed as PM on this project; DEVELOPER/DESIGNER must be an active member of it (any staff role).',
  })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Missing required reason' })
  @ApiResponse({
    status: 403,
    description:
      'Only ADMIN/SYSTEM_ADMIN can cancel a project or reopen a COMPLETED/CANCELLED one, only PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN can put a project ON_HOLD, or caller is not staffed on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({
    status: 409,
    description:
      'Status transition not allowed, or the project is archived (use restore instead)',
  })
  @RequirePermissions(Permission.CHANGE_PROJECT_STATUS)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProjectStatusDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.updateStatus(id, dto, user.id, user.role);
  }

  @ApiOperation({
    summary: 'Archive a project',
    description:
      'Independent of status changes — only a COMPLETED or CANCELLED project can be archived. ADMIN/SYSTEM_ADMIN only, PROJECT_MANAGER cannot archive.',
  })
  @ApiResponse({ status: 200, description: 'Project archived' })
  @ApiResponse({
    status: 403,
    description: 'Only ADMIN or SYSTEM_ADMIN can archive a project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({
    status: 409,
    description: 'Project is not COMPLETED/CANCELLED, or already archived',
  })
  @RequirePermissions(Permission.ARCHIVE_PROJECT)
  @Patch(':id/archive')
  archive(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.archive(id, user.id, user.role);
  }

  @ApiOperation({
    summary: 'Restore an archived project',
    description:
      'Brings an archived COMPLETED/CANCELLED project back to READY_FOR_WORK in one step, clearing archivedAt/completedAt/cancellationReason. ADMIN/SYSTEM_ADMIN only. A project that was never archived uses PATCH /projects/:id/status (COMPLETED/CANCELLED to READY_FOR_WORK) instead.',
  })
  @ApiResponse({ status: 200, description: 'Project restored' })
  @ApiResponse({
    status: 403,
    description: 'Only ADMIN or SYSTEM_ADMIN can restore a project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 409, description: 'Project is not archived' })
  @RequirePermissions(Permission.ARCHIVE_PROJECT)
  @Patch(':id/restore')
  restore(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.restore(id, user.id, user.role);
  }
}
