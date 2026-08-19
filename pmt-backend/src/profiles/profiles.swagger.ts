import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import {
  commonErrors,
  gatedErrors,
  notFound,
} from '@/common/swagger/error-sets';
import { ProfileResponseDto } from '@/profiles/dto/profile.dto';

/** The multipart body shape for an avatar upload. Swagger cannot infer it. */
const avatarBody = ApiBody({
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
});

export const ApiGetOwnProfileDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Get the caller's own profile",
      description:
        'Returns the user plus whichever profile table applies to their role. Exactly ' +
        'one of employeeProfile and clientProfile is populated; which one is derived ' +
        'live from the role, there is no stored flag.',
    }),
    ApiResponse({ status: 200, type: ProfileResponseDto }),
    ...commonErrors,
  );

export const ApiUpdateOwnProfileDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Update the caller's own profile",
      description:
        'The body is a superset of both profile tables. Fields belonging to the other ' +
        'role are ignored rather than rejected. A change to name is written to the ' +
        'User row and audited; a no-op change writes no audit row.',
    }),
    ApiResponse({ status: 200, type: ProfileResponseDto }),
    ...commonErrors,
  );

export const ApiUploadOwnAvatarDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Upload or replace the caller's own avatar",
      description:
        'multipart/form-data with a single "file" field. Images only, 5MB cap. This is ' +
        'POST rather than PATCH on purpose: each call creates a brand new Cloudinary ' +
        'asset with its own public id and deletes the previous one, so it is not ' +
        'idempotent.',
    }),
    ApiConsumes('multipart/form-data'),
    avatarBody,
    ApiResponse({
      status: 201,
      description: 'The updated profile',
      type: ProfileResponseDto,
    }),
    ...commonErrors,
  );

export const ApiGetUserProfileDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Get another user's profile by id",
      description:
        'For staffing lookups. Read only, and never exposes credentials.',
    }),
    ApiParam({ name: 'userId', description: 'The user id' }),
    ApiResponse({ status: 200, type: ProfileResponseDto }),
    ...gatedErrors,
    notFound('User not found'),
  );
