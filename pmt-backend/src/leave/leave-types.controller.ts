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
import { LeaveTypesService } from './leave-types.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  ApiCreateLeaveTypeDocs,
  ApiDeleteLeaveTypeDocs,
  ApiListLeaveTypesDocs,
  ApiUpdateLeaveTypeDocs,
} from '@/leave/leave.swagger';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from '@/leave/dto/leave.dto';

@ApiTags('Leave Types')
@ApiCookieAuth('better-auth.session_token')
@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @ApiListLeaveTypesDocs()
  @RequirePermissions(Permission.VIEW_LEAVE_TYPES)
  @Get()
  findAll() {
    return this.leaveTypesService.findAll();
  }

  @ApiCreateLeaveTypeDocs()
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @Post()
  create(@Body() dto: CreateLeaveTypeDto, @CurrentUser() user: { id: string }) {
    return this.leaveTypesService.create(dto, user.id);
  }

  @ApiUpdateLeaveTypeDocs()
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.leaveTypesService.update(id, dto, user.id);
  }

  @ApiDeleteLeaveTypeDocs()
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.leaveTypesService.remove(id, user.id);
  }
}
