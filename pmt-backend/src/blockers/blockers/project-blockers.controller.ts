import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { BlockerService } from '@/blockers/blockers/blocker.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiBlockerDeadlineImpactDocs,
  ApiListProjectBlockersDocs,
} from '@/blockers/blockers.swagger';
import { QueryProjectBlockersDto } from '@/blockers/dto/blocker.dto';

// The PM dashboard view of blockers, scoped to one project. The write side
// (add/update) lives in BlockersController's top level routes instead, since
// a blocker isn't reported through a project specific flow.

@ApiTags('Blockers')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/blockers')
export class ProjectBlockersController {
  constructor(private readonly blockerService: BlockerService) {}

  @ApiListProjectBlockersDocs()
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

  @ApiBlockerDeadlineImpactDocs()
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
