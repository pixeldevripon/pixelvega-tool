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
import { BlockerService } from '@/projects/blockers/blocker.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiBlockerDeadlineImpactDocs,
  ApiListProjectBlockersDocs,
  ApiReportBlockerDocs,
  ApiUpdateBlockerDocs,
} from '@/projects/blockers/blockers.swagger';
import {
  AddBlockerDto,
  QueryProjectBlockersDto,
  UpdateBlockerDto,
} from '@/projects/blockers/dto/blocker.dto';

/**
 * Blockers on one project: the reads AND every write.
 *
 * A blocker cannot exist without a project, so ADR 0004 puts its mutations
 * here rather than at the top level. `POST /blockers` used to take the project
 * in the request BODY, which meant the same resource was created at a path that
 * did not mention its parent, and `PATCH /blockers/:blockerId` could edit a
 * blocker on any project from one address. The cross-project list stays at
 * `GET /blockers`, read only, with filters as query params.
 */
@ApiTags('Blockers')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/blockers')
export class ProjectBlockersController {
  constructor(private readonly blockerService: BlockerService) {}

  @ApiReportBlockerDocs()
  @RequirePermissions(Permission.REPORT_BLOCKER)
  @Post()
  addBlocker(
    @Param('projectId') projectId: string,
    @Body() dto: AddBlockerDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.blockerService.addBlocker(projectId, dto, user.id, user.role);
  }

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

  // Static before dynamic: below `:blockerId`, Nest would match
  // `deadline-impact` as a blocker id.
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

  @ApiUpdateBlockerDocs()
  @RequirePermissions(Permission.REPORT_BLOCKER)
  @Patch(':blockerId')
  updateBlocker(
    @Param('projectId') projectId: string,
    @Param('blockerId') blockerId: string,
    @Body() dto: UpdateBlockerDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.blockerService.updateBlocker(
      projectId,
      blockerId,
      dto,
      user.id,
      user.role,
    );
  }
}
