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
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { LeaveTypesService } from './leave-types.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Leave Types')
@ApiCookieAuth('better-auth.session_token')
@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @ApiOperation({ summary: 'List all leave types' })
  @ApiResponse({ status: 200, description: 'Leave types' })
  @Get()
  findAll() {
    return this.leaveTypesService.findAll();
  }

  @ApiOperation({ summary: 'Create a leave type. ADMIN only.' })
  @ApiResponse({ status: 201, description: 'Leave type created' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @Roles([Role.ADMIN])
  @Post()
  create(@Body() dto: CreateLeaveTypeDto, @CurrentUser() user: { id: string }) {
    return this.leaveTypesService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Update a leave type. ADMIN only.' })
  @ApiResponse({ status: 200, description: 'Leave type updated' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  @Roles([Role.ADMIN])
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
  @Roles([Role.ADMIN])
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.leaveTypesService.remove(id, user.id);
  }
}
