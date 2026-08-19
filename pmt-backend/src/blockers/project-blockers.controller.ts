import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { BlockerService } from './blocker.service';
import { QueryProjectBlockersDto } from '@/blockers/dto/query-project-blockers.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

// The PM dashboard view of blockers, scoped to one project. The write side
// (add/update) lives in BlockersController's top level routes instead, since
// a blocker isn't reported through a project specific flow.

@ApiTags('Blockers')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/blockers')
export class ProjectBlockersController {
  constructor(private readonly blockerService: BlockerService) {}

  @ApiOperation({
    summary: "This project's blockers, active and resolved",
    description:
      'Company-wide for any PROJECT_MANAGER (or ADMIN/SYSTEM_ADMIN) — viewing does not require being staffed on this specific project, only editing/resolving a blocker does. DEVELOPER/DESIGNER must be an active member of this project. Filter by status/severity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated blockers with resolution metrics',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({
    status: 403,
    description: 'DEVELOPER/DESIGNER not an active member of this project',
  })
  @RequirePermissions(Permission.VIEW_BLOCKERS)
  @Get()
  findByProject(
    @Param('projectId') projectId: string,
    @Query() query: QueryProjectBlockersDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.blockerService.findByProject(
      projectId,
      query,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: "How much this project's blockers have cost the schedule",
    description:
      'Total resolution time and deadline extension days across resolved blockers, computed on read. Same read-scoping as the list endpoint above.',
  })
  @ApiResponse({
    status: 200,
    description:
      'resolvedCount, totalResolutionMinutes, totalDeadlineExtensionDays, blockersWithExtension',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({
    status: 403,
    description: 'DEVELOPER/DESIGNER not an active member of this project',
  })
  @RequirePermissions(Permission.VIEW_BLOCKERS)
  @Get('deadline-impact')
  getDeadlineImpactSummary(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.blockerService.getDeadlineImpactSummary(
      projectId,
      user.id,
      user.role,
    );
  }
}
