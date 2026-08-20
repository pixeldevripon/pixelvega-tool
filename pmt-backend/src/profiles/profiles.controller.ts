import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  DeleteAccountRequestDto,
  UpdateProfileRequestDto,
} from '@/profiles/dto/profile.dto';
import { imageUploadOptions } from '@/uploads/upload-options';
import {
  ApiDeleteOwnAccountDocs,
  ApiDisconnectOwnConnectionDocs,
  ApiGetOwnProfileDocs,
  ApiGetProfileOptionsDocs,
  ApiGetUserProfileDocs,
  ApiRemoveOwnAvatarDocs,
  ApiUpdateOwnProfileDocs,
  ApiUploadOwnAvatarDocs,
} from './profiles.swagger';
import { ProfilesService } from './profiles.service';

/**
 * Routing only. Documentation lives in profiles.swagger.ts.
 *
 * Static routes are declared above dynamic ones: `options`, `me` and everything
 * under `me` must come before `:userId`, or Nest matches them as a user id.
 */
@ApiTags('Profiles')
@ApiCookieAuth('better-auth.session_token')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @ApiGetProfileOptionsDocs()
  @RequirePermissions(Permission.VIEW_OWN_PROFILE)
  @Get('options')
  options() {
    return this.profilesService.getOptions();
  }

  @ApiGetOwnProfileDocs()
  @RequirePermissions(Permission.VIEW_OWN_PROFILE)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.profilesService.findOwnProfile(user.id);
  }

  @ApiUpdateOwnProfileDocs()
  @RequirePermissions(Permission.EDIT_OWN_PROFILE)
  @Patch('me')
  updateMe(
    @Body() dto: UpdateProfileRequestDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.profilesService.update(user.id, user.role, dto);
  }

  @ApiUploadOwnAvatarDocs()
  @RequirePermissions(Permission.EDIT_OWN_PROFILE)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ) {
    // Multer rejects a wrong mimetype or an oversized file itself; this is the
    // "field present but empty" case, which reaches the handler as undefined.
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.profilesService.updateAvatar(user.id, file);
  }

  @ApiRemoveOwnAvatarDocs()
  @RequirePermissions(Permission.EDIT_OWN_PROFILE)
  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: { id: string }) {
    return this.profilesService.removeAvatar(user.id);
  }

  @ApiDisconnectOwnConnectionDocs()
  @RequirePermissions(Permission.EDIT_OWN_PROFILE)
  @Delete('me/connections/:provider')
  disconnect(
    @Param('provider') provider: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.profilesService.disconnect(user.id, provider);
  }

  @ApiDeleteOwnAccountDocs()
  @RequirePermissions(Permission.DELETE_OWN_ACCOUNT)
  @Delete('me')
  deleteMe(
    @Body() dto: DeleteAccountRequestDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.profilesService.deleteOwnAccount(
      user.id,
      user.role,
      dto.confirmEmail,
    );
  }

  @ApiGetUserProfileDocs()
  @RequirePermissions(Permission.VIEW_USER_PROFILE)
  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.profilesService.findByUserId(userId);
  }
}
