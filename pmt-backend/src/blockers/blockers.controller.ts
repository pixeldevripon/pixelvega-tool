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
import { BlockerService } from './blocker.service';
import { AddBlockerDto } from '@/blockers/dto/add-blocker.dto';
import { UpdateBlockerDto } from '@/blockers/dto/update-blocker.dto';
import { QueryBlockersDto } from '@/blockers/dto/query-blockers.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

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

  @ApiOperation({
    summary: 'Report a blocker, anytime, independent of any daily report',
    description:
      'Created with status OPEN. Not tied to a DailyWorkReport — can be reported at any time by an active member of the target project (any role). ADMIN/SYSTEM_ADMIN can report on any project.',
  })
  @ApiResponse({ status: 201, description: 'Blocker created' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({
    status: 403,
    description: 'Not an active member of the target project',
  })
  @RequirePermissions(Permission.REPORT_BLOCKER)
  @Post()
  addBlocker(
    @Body() dto: AddBlockerDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.blockerService.addBlocker(dto, user.id, user.role);
  }

  @ApiOperation({
    summary: 'Update a blocker (description/severity/status/assignee)',
    description:
      'Only the reporter (if still an active member of the project) or a PROJECT_MANAGER of that project (or ADMIN/SYSTEM_ADMIN) may update. Locked once RESOLVED. resolutionNotes is required when resolving; status moves are forward-only (OPEN -> IN_PROGRESS -> RESOLVED). Moving to IN_PROGRESS auto-assigns the caller unless assignedToId is given explicitly.',
  })
  @ApiResponse({ status: 200, description: 'Blocker updated' })
  @ApiResponse({
    status: 400,
    description:
      'resolutionNotes/deadlineExtensionDays missing or invalid for the requested status change',
  })
  @ApiResponse({
    status: 403,
    description:
      'Not an active member of this project (including a reporter who has since left), and not a PM of this project',
  })
  @ApiResponse({ status: 404, description: 'Blocker not found' })
  @ApiResponse({
    status: 409,
    description: 'Already resolved, or an invalid (backward) status move',
  })
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

  @ApiOperation({
    summary: 'List blockers',
    description:
      'PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN see company-wide. DEVELOPER/DESIGNER are scoped to blockers on projects they are actively staffed on. Filter by status, severity, and/or projectId.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated blockers with resolution metrics',
  })
  @RequirePermissions(Permission.VIEW_BLOCKERS)
  @Get()
  findAll(
    @Query() query: QueryBlockersDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.blockerService.findAll(query, user.id, user.role);
  }
}
