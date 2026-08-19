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
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Permission, Role } from '@prisma/client';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { PermissionsService } from '@/auth/permissions.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ROLE_DISPLAY, toEnumDisplay } from '@/common/utils/enum-display.util';
import {
  ChangeOwnPasswordRequestDto,
  InviteUserRequestDto,
  QueryUsersDto,
  UpdateUserRequestDto,
} from '@/users/dto/user.dto';
import {
  ApiChangeOwnPasswordDocs,
  ApiDeleteUserDocs,
  ApiGetOwnPermissionsDocs,
  ApiGetOwnProfileDocs,
  ApiGetUserDocs,
  ApiInviteUserDocs,
  ApiListUsersDocs,
  ApiUpdateUserDocs,
} from './users.swagger';
import { UsersService } from './users.service';

/**
 * Routing only. Every rule this API enforces about users lives in UsersService,
 * because the interesting ones depend on the TARGET user's current role and a
 * decorator cannot express that. Documentation lives in users.swagger.ts.
 *
 * Static routes are declared above dynamic ones: `me` and `me/permissions` must
 * come before `:id`, or Nest matches them as an id.
 */
@ApiTags('Users')
@ApiCookieAuth('better-auth.session_token')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @ApiInviteUserDocs()
  @RequirePermissions(Permission.INVITE_USER)
  @Post('invite')
  invite(
    @Body() dto: InviteUserRequestDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.usersService.invite(dto, user.id, user.role);
  }

  @ApiChangeOwnPasswordDocs()
  @RequirePermissions(Permission.CHANGE_OWN_PASSWORD)
  @Patch('me/password')
  changePassword(
    @Body() dto: ChangeOwnPasswordRequestDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.usersService.changePassword(dto, user.id, req);
  }

  @ApiGetOwnProfileDocs()
  @RequirePermissions(Permission.VIEW_OWN_PROFILE)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.usersService.findOne(user.id);
  }

  @ApiGetOwnPermissionsDocs()
  @RequirePermissions(Permission.VIEW_OWN_PERMISSIONS)
  @Get('me/permissions')
  myPermissions(@CurrentUser() user: { id: string; role: Role }) {
    return {
      role: toEnumDisplay(ROLE_DISPLAY, user.role),
      permissions: this.permissionsService.getEffectivePermissions(user),
    };
  }

  @ApiListUsersDocs()
  @RequirePermissions(Permission.VIEW_USERS)
  @Get()
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @ApiGetUserDocs()
  @RequirePermissions(Permission.VIEW_USERS)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiUpdateUserDocs()
  @RequirePermissions(Permission.UPDATE_USER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserRequestDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.usersService.update(id, dto, user.id, user.role);
  }

  @ApiDeleteUserDocs()
  @RequirePermissions(Permission.DELETE_USER)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.usersService.remove(id, user.id, user.role);
  }
}
