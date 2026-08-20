import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { BlockerReasonsService } from '@/projects/blockers/reasons/blocker-reasons.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiCreateBlockerReasonDocs,
  ApiDeleteBlockerReasonDocs,
  ApiListBlockerReasonsDocs,
  ApiUpdateBlockerReasonDocs,
} from '@/projects/blockers/blockers.swagger';
import {
  CreateBlockerReasonDto,
  UpdateBlockerReasonDto,
} from '@/projects/blockers/dto/blocker.dto';

// Read is open to anyone who can see blockers, excluding CLIENT, who never
// touches the Blocker feature at all. Writes are limited to PROJECT_MANAGER
// (plus ADMIN/SYSTEM_ADMIN automatically). Reasons are global, not scoped to
// a project, so unlike other PM gated routes in this module there's no per
// project assertManagesProject() staffing check here.

@ApiTags('Blocker Reasons')
@ApiCookieAuth('better-auth.session_token')
@Controller('blockers/reasons')
export class BlockerReasonsController {
  constructor(private readonly blockerReasonsService: BlockerReasonsService) {}

  @ApiListBlockerReasonsDocs()
  @RequirePermissions(Permission.VIEW_BLOCKERS)
  @Get()
  findAll() {
    return this.blockerReasonsService.findAll();
  }

  @ApiCreateBlockerReasonDocs()
  @RequirePermissions(Permission.MANAGE_BLOCKER_REASONS)
  @Post()
  create(
    @Body() dto: CreateBlockerReasonDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.blockerReasonsService.create(dto, user.id);
  }

  @ApiUpdateBlockerReasonDocs()
  @RequirePermissions(Permission.MANAGE_BLOCKER_REASONS)
  @Patch(':reasonId')
  update(
    @Param('reasonId') id: string,
    @Body() dto: UpdateBlockerReasonDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.blockerReasonsService.update(id, dto, user.id);
  }

  @ApiDeleteBlockerReasonDocs()
  @RequirePermissions(Permission.MANAGE_BLOCKER_REASONS)
  @Delete(':reasonId')
  remove(@Param('reasonId') id: string, @CurrentUser() user: { id: string }) {
    return this.blockerReasonsService.remove(id, user.id);
  }
}
