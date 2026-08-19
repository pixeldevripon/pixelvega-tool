import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { ProjectsService } from './projects.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import { RequireAnyPermission } from '@/auth/permissions/require-any-permission.decorator';
import {
  ApiArchiveProjectDocs,
  ApiConnectProjectSlackDocs,
  ApiCreateProjectDocs,
  ApiGetProjectActivityDocs,
  ApiGetProjectDocs,
  ApiListOwnProjectsDocs,
  ApiListProjectsDocs,
  ApiListUserProjectsDocs,
  ApiRestoreProjectDocs,
  ApiUpdateEstimatedHoursDocs,
  ApiUpdateProjectDocs,
  ApiUpdateProjectPriorityDocs,
  ApiUpdateProjectStatusDocs,
  ApiUpdateProjectTypesDocs,
} from '@/projects/projects.swagger';
import {
  ConnectSlackChannelDto,
  CreateProjectDto,
  QueryMyProjectsDto,
  QueryProjectsDto,
  UpdateEstimatedHoursDto,
  UpdateProjectDto,
  UpdateProjectPriorityDto,
  UpdateProjectStatusDto,
  UpdateProjectTypesDto,
} from '@/projects/dto/project.dto';

// Create, list all, and manage routes stay limited to staff (any
// PROJECT_MANAGER, plus ADMIN/SYSTEM_ADMIN automatically). Single project
// reads (findOne, findActivities, findMine) instead scope to the caller.
// See their individual @Roles and the service layer checks they call.

@ApiTags('Projects')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiCreateProjectDocs()
  @RequirePermissions(Permission.CREATE_PROJECT)
  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.create(dto, user.id, user.role);
  }

  @ApiListProjectsDocs()
  @RequirePermissions(Permission.VIEW_ALL_PROJECTS)
  @Get()
  findAll(
    @Query() query: QueryProjectsDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.findAll(query, user.id, user.role);
  }

  @ApiListOwnProjectsDocs()
  @RequirePermissions(Permission.VIEW_OWN_PROJECTS)
  @Get('mine')
  findMine(
    @Query() query: QueryMyProjectsDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.findMine(user.id, user.role, query);
  }

  @ApiListUserProjectsDocs()
  @RequirePermissions(Permission.VIEW_ALL_PROJECTS)
  @Get('users/:userId')
  findForUser(
    @Param('userId') userId: string,
    @Query() query: QueryMyProjectsDto,
  ) {
    return this.projectsService.findForUser(userId, query);
  }

  @ApiGetProjectDocs()
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

  @ApiGetProjectActivityDocs()
  @RequirePermissions(Permission.VIEW_PROJECT_ACTIVITY)
  @Get(':id/activities')
  findActivities(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.findActivities(id, query, user.id, user.role);
  }

  @ApiUpdateProjectDocs()
  @RequirePermissions(Permission.EDIT_PROJECT)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.update(id, dto, user.id, user.role);
  }

  @ApiUpdateProjectPriorityDocs()
  @RequirePermissions(Permission.CHANGE_PROJECT_PRIORITY)
  @Patch(':id/priority')
  updatePriority(
    @Param('id') id: string,
    @Body() dto: UpdateProjectPriorityDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.updatePriority(id, dto, user.id, user.role);
  }

  @ApiUpdateEstimatedHoursDocs()
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

  @ApiConnectProjectSlackDocs()
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

  @ApiUpdateProjectTypesDocs()
  @RequirePermissions(Permission.MANAGE_PROJECT_TYPES)
  @Patch(':id/types')
  updateTypes(
    @Param('id') id: string,
    @Body() dto: UpdateProjectTypesDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.updateTypes(id, dto, user.id, user.role);
  }

  @ApiUpdateProjectStatusDocs()
  @RequirePermissions(Permission.CHANGE_PROJECT_STATUS)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProjectStatusDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.updateStatus(id, dto, user.id, user.role);
  }

  @ApiArchiveProjectDocs()
  @RequirePermissions(Permission.ARCHIVE_PROJECT)
  @Patch(':id/archive')
  archive(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.archive(id, user.id, user.role);
  }

  @ApiRestoreProjectDocs()
  @RequirePermissions(Permission.ARCHIVE_PROJECT)
  @Patch(':id/restore')
  restore(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.restore(id, user.id, user.role);
  }
}
