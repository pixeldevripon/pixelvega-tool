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
  ApiListBlockersDocs,
  ApiReportBlockerDocs,
  ApiUpdateBlockerDocs,
} from '@/projects/blockers/blockers.swagger';
import {
  AddBlockerDto,
  QueryBlockersDto,
  UpdateBlockerDto,
} from '@/projects/blockers/dto/blocker.dto';

// Deliberately not nested under projects/:projectId. A blocker can be
// reported and updated from a single top level endpoint regardless of which
// project it belongs to. The read scoped to one project (PM dashboard) lives
// in ProjectBlockersController instead.
/**
 * Blockers across every project. READ ONLY.
 *
 * ADR 0004: a resource that needs a project mutates under
 * `/projects/:projectId/blockers`, and appears once at the top level as a
 * cross-project view that takes its filters as query params. Reporting and
 * editing used to live here, which meant a blocker was created at an address
 * that did not name its own project.
 *
 * DEVELOPER and DESIGNER see only blockers on projects they are actively
 * staffed on, enforced in `BlockerService.findAll()` by a membership filter.
 * PROJECT_MANAGER sees every project.
 */

@ApiTags('Blockers')
@ApiCookieAuth('better-auth.session_token')
@Controller('blockers')
export class BlockersController {
  constructor(private readonly blockerService: BlockerService) {}

  @ApiListBlockersDocs()
  @RequirePermissions(Permission.VIEW_BLOCKERS)
  @Get()
  findAll(
    @Query() query: QueryBlockersDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.blockerService.findAll(query, user.id, user.role);
  }
}
