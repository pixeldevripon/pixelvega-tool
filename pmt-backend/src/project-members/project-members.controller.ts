import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ProjectMembersService } from './project-members.service';
import {
  AddProjectMemberDto,
  QueryProjectMembersDto,
} from '@/project-members/dto/project-member.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  ApiAddProjectMemberDocs,
  ApiListProjectMembersDocs,
  ApiRemoveProjectMemberDocs,
  ApiResyncMemberSlackDocs,
} from '@/project-members/project-staffing.swagger';

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

  @ApiListProjectMembersDocs()
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

  @ApiAddProjectMemberDocs()
  @RequirePermissions(Permission.MANAGE_PROJECT_MEMBERS)
  @Post()
  add(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectMembersService.add(projectId, dto, user.id, user.role);
  }

  @ApiRemoveProjectMemberDocs()
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

  @ApiResyncMemberSlackDocs()
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
