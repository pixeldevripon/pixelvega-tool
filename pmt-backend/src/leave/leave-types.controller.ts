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
import { LeaveTypesService } from './leave-types.service';
import { CreateLeaveTypeDto } from '@/leave/dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from '@/leave/dto/update-leave-type.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

@ApiTags('Leave Types')
@ApiCookieAuth('better-auth.session_token')
@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @ApiOperation({ summary: 'List all leave types' })
  @ApiResponse({ status: 200, description: 'Leave types' })
  @RequirePermissions(Permission.VIEW_LEAVE_TYPES)
  @Get()
  findAll() {
    return this.leaveTypesService.findAll();
  }

  @ApiOperation({ summary: 'Create a leave type. ADMIN only.' })
  @ApiResponse({ status: 201, description: 'Leave type created' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @Post()
  create(@Body() dto: CreateLeaveTypeDto, @CurrentUser() user: { id: string }) {
    return this.leaveTypesService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Update a leave type. ADMIN only.' })
  @ApiResponse({ status: 200, description: 'Leave type updated' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.leaveTypesService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: 'Delete a leave type. ADMIN only.' })
  @ApiResponse({ status: 200, description: 'Leave type deleted' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.leaveTypesService.remove(id, user.id);
  }
}
