import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { BlockerReasonsService } from './blocker-reasons.service';
import { CreateBlockerReasonDto } from '@/blockers/dto/create-blocker-reason.dto';
import { UpdateBlockerReasonDto } from '@/blockers/dto/update-blocker-reason.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

// Read is open to anyone who can see blockers, excluding CLIENT, who never
// touches the Blocker feature at all. Writes are limited to PROJECT_MANAGER
// (plus ADMIN/SYSTEM_ADMIN automatically). Reasons are global, not scoped to
// a project, so unlike other PM gated routes in this module there's no per
// project assertManagesProject() staffing check here.

@ApiTags('Blocker Reasons')
@ApiCookieAuth('better-auth.session_token')
@Controller('blocker-reasons')
export class BlockerReasonsController {
  constructor(private readonly blockerReasonsService: BlockerReasonsService) {}

  @ApiOperation({ summary: 'List all blocker reasons' })
  @ApiResponse({ status: 200, description: 'Blocker reasons' })
  @RequirePermissions(Permission.VIEW_BLOCKERS)
  @Get()
  findAll() {
    return this.blockerReasonsService.findAll();
  }

  @ApiOperation({
    summary: 'Create a blocker reason. PROJECT_MANAGER/ADMIN only.',
  })
  @ApiResponse({ status: 201, description: 'Blocker reason created' })
  @ApiResponse({ status: 403, description: 'Caller is not PM/ADMIN' })
  @ApiResponse({
    status: 409,
    description: 'A reason with this name already exists',
  })
  @RequirePermissions(Permission.MANAGE_BLOCKER_REASONS)
  @Post()
  create(
    @Body() dto: CreateBlockerReasonDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.blockerReasonsService.create(dto, user.id);
  }

  @ApiOperation({
    summary: 'Rename a blocker reason. PROJECT_MANAGER/ADMIN only.',
    description: 'The default "Unspecified" reason cannot be renamed.',
  })
  @ApiResponse({ status: 200, description: 'Blocker reason updated' })
  @ApiResponse({
    status: 403,
    description:
      'Caller is not PM/ADMIN, or attempting to rename the default reason',
  })
  @ApiResponse({ status: 404, description: 'Blocker reason not found' })
  @ApiResponse({
    status: 409,
    description: 'A reason with this name already exists',
  })
  @RequirePermissions(Permission.MANAGE_BLOCKER_REASONS)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBlockerReasonDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.blockerReasonsService.update(id, dto, user.id);
  }

  @ApiOperation({
    summary: 'Delete a blocker reason. PROJECT_MANAGER/ADMIN only.',
    description:
      'Soft delete (sets deletedAt) — existing blockers keep referencing it, it just drops out of the picker for new blockers. The default "Unspecified" reason cannot be deleted.',
  })
  @ApiResponse({ status: 200, description: 'Blocker reason deleted' })
  @ApiResponse({
    status: 403,
    description:
      'Caller is not PM/ADMIN, or attempting to delete the default reason',
  })
  @ApiResponse({ status: 404, description: 'Blocker reason not found' })
  @RequirePermissions(Permission.MANAGE_BLOCKER_REASONS)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.blockerReasonsService.remove(id, user.id);
  }
}
