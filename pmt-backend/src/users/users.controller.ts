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
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import { PermissionsService } from '@/auth/permissions/permissions.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ROLE_DISPLAY, toEnumDisplay } from '@/common/utils/enum-display.util';
import {
  InviteUserRequestDto,
  QueryUsersDto,
  UpdateUserRequestDto,
} from '@/users/dto/user.dto';
import {
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

  /**
   * There is deliberately no password change route here.
   *
   * `POST /api/auth/change-password` is better-auth's, it requires the current
   * password, and an after hook in `auth.instance.ts` clears
   * `mustResetPassword` and writes the `user.password_changed` audit entry. A
   * wrapper in this controller used to do those two things, which meant two
   * doors onto one action with different security properties: better-auth's own
   * route stayed reachable and was gated by neither a permission nor an audit
   * trail. One door, and it is the library's.
   */

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
