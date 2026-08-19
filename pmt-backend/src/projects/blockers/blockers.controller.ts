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
// Same role set as REPORT_ROLES. DEVELOPER/DESIGNER only see blockers on
// projects they're actively staffed on (enforced in BlockerService.findAll()
// via a project membership filter); PROJECT_MANAGER can see every project.

@ApiTags('Blockers')
@ApiCookieAuth('better-auth.session_token')
@Controller('blockers')
export class BlockersController {
  constructor(private readonly blockerService: BlockerService) {}

  @ApiReportBlockerDocs()
  @RequirePermissions(Permission.REPORT_BLOCKER)
  @Post()
  addBlocker(
    @Body() dto: AddBlockerDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.blockerService.addBlocker(dto, user.id, user.role);
  }

  @ApiUpdateBlockerDocs()
  @RequirePermissions(Permission.REPORT_BLOCKER)
  @Patch(':blockerId')
  updateBlocker(
    @Param('blockerId') blockerId: string,
    @Body() dto: UpdateBlockerDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.blockerService.updateBlocker(
      blockerId,
      dto,
      user.id,
      user.role,
    );
  }

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
