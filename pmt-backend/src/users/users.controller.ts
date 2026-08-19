import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Permission, Role } from '@prisma/client';
import { PermissionsService } from '@/auth/permissions.service';
import { UsersService } from './users.service';
import { InviteUserDto } from '@/users/dto/invite-user.dto';
import { ChangePasswordDto } from '@/users/dto/change-password.dto';
import { UpdateUserDto } from '@/users/dto/update-user.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

@ApiTags('Users')
@ApiCookieAuth('better-auth.session_token')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @ApiOperation({
    summary: 'Invite a new user',
    description:
      'Creates the account, emails a temporary password. ADMIN only.',
  })
  @ApiResponse({ status: 201, description: 'User invited' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @RequirePermissions(Permission.INVITE_USER)
  @Post('invite')
  async invite(
    @Body() dto: InviteUserDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.usersService.invite(dto, user.id, user.role);
  }

  @ApiOperation({ summary: "Change the caller's own password" })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 400, description: 'Current password is incorrect' })
  @Patch('me/password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.usersService.changePassword(dto, user.id, req);
  }

  @ApiOperation({ summary: "Get the caller's own profile" })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.usersService.findOne(user.id);
  }

  @ApiOperation({
    summary: "Get the caller's effective permissions",
    description:
      'The capability set this session holds, resolved from the caller role. ' +
      'This is what a client gates its UI from: it must never derive a ' +
      'capability from the role string itself, because the mapping lives here ' +
      'and can change without the client knowing.',
  })
  @ApiResponse({
    status: 200,
    description: 'The effective permission set, plus the role it came from',
  })
  @Get('me/permissions')
  myPermissions(@CurrentUser() user: { id: string; role: Role }) {
    return {
      role: user.role,
      permissions: this.permissionsService.getEffectivePermissions(user),
    };
  }

  @ApiOperation({
    summary: 'List all users',
    description: 'Paginated, newest first.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of users' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not ADMIN or PROJECT_MANAGER',
  })
  @RequirePermissions(Permission.VIEW_USERS)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @ApiOperation({ summary: 'Get a single user by id' })
  @ApiResponse({ status: 200, description: 'The user' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not ADMIN or PROJECT_MANAGER',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @RequirePermissions(Permission.VIEW_USERS)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a user. ADMIN only.' })
  @ApiResponse({ status: 200, description: 'Updated user' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @RequirePermissions(Permission.UPDATE_USER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.usersService.update(id, dto, user.id, user.role);
  }

  @ApiOperation({ summary: 'Soft-delete a user. ADMIN only.' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @RequirePermissions(Permission.DELETE_USER)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.usersService.remove(id, user.id, user.role);
  }
}
