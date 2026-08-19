import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from '@/profiles/dto/update-profile.dto';
import { imageUploadOptions } from '@/uploads/image-upload.options';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

@ApiTags('Profiles')
@ApiCookieAuth('better-auth.session_token')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @ApiOperation({ summary: "Get the caller's own profile" })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.profilesService.findByUserId(user.id);
  }

  @ApiOperation({ summary: "Update the caller's own profile" })
  @ApiResponse({ status: 200, description: 'Updated profile' })
  @Patch('me')
  updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.profilesService.update(user.id, user.role, dto);
  }

  @ApiOperation({
    summary: "Upload or replace the caller's own avatar",
    description:
      'multipart/form-data with a single "file" field. Max 5MB, images only. ',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Updated profile' })
  @ApiResponse({ status: 400, description: 'Missing file or not an image' })
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.profilesService.updateAvatar(user.id, file);
  }

  @ApiOperation({ summary: "Get a user's profile by id" })
  @ApiResponse({ status: 200, description: 'The profile' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not ADMIN or PROJECT_MANAGER',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @RequirePermissions(Permission.VIEW_USER_PROFILE)
  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.profilesService.findByUserId(userId);
  }
}
