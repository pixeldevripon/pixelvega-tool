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
import {
  MessageResponseDto,
  OwnProfileResponseDto,
  ProfileOptionsResponseDto,
  ProfileResponseDto,
} from '@/profiles/dto/profile.dto';

/** The multipart body shape for an avatar upload. Swagger cannot infer it. */
const avatarBody = ApiBody({
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
});

export const ApiGetProfileOptionsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Reference data for the account form',
      description:
        'The country list, the gender list, every role, the password policy, and the two limits the copy quotes. ' +
        'Identical for every caller and changes only on deploy, so a client caches it for the session. ' +
        'It is a route rather than a constant in the client because none of these belong to a browser: a country list is a political question, ' +
        'a password rule is a gate the server enforces, and an upload cap is a number multer owns.',
    }),
    ApiResponse({ status: 200, type: ProfileOptionsResponseDto }),
    ...commonErrors,
  );

export const ApiGetOwnProfileDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Get the caller's own profile",
      description:
        'The account screen reads this. It carries the personal fields flat (firstName, lastName, phone, country, gender, socialUrls), ' +
        'the capability flags that decide which controls the screen offers, the list of connected accounts, ' +
        'and whichever profile table applies to the role. Exactly one of employeeProfile and clientProfile is populated; ' +
        'which one is derived live from the role, there is no stored flag. ' +
        'phone is hoisted out of that table so a form binds to one field instead of branching on the role to find it.',
    }),
    ApiResponse({ status: 200, type: OwnProfileResponseDto }),
    ...commonErrors,
  );

export const ApiUpdateOwnProfileDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Update the caller's own profile",
      description:
        'The body is a superset of the User row and both profile tables. Fields belonging to the other role are ignored rather than rejected. ' +
        'name is deliberately not accepted: it is composed from firstName and lastName, so a caller cannot store a full name that contradicts its own halves. ' +
        'socialUrls replaces the whole list; send an empty array to clear it. country takes an empty string to clear it. ' +
        'A no-op change writes no audit row.',
    }),
    ApiResponse({ status: 200, type: OwnProfileResponseDto }),
    ...commonErrors,
  );

export const ApiUploadOwnAvatarDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Upload or replace the caller's own avatar",
      description:
        'multipart/form-data with a single "file" field. Images only, and the size cap is served by GET /profiles/options. ' +
        'This is POST rather than PATCH on purpose: each call creates a brand new Cloudinary asset with its own public id ' +
        'and deletes the previous one, so it is not idempotent.',
    }),
    ApiConsumes('multipart/form-data'),
    avatarBody,
    ApiResponse({
      status: 201,
      description: 'The updated profile',
      type: OwnProfileResponseDto,
    }),
    ...commonErrors,
  );

export const ApiRemoveOwnAvatarDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Remove the caller's own avatar",
      description:
        'Clears the column and destroys the stored Cloudinary asset. Its own route rather than a field on PATCH /profiles/me, ' +
        'because it has a side effect outside this database and a PATCH that otherwise only writes columns should not hide one.',
    }),
    ApiResponse({ status: 200, type: OwnProfileResponseDto }),
    ...commonErrors,
  );

export const ApiDisconnectOwnConnectionDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Remove a connected account',
      description:
        'Only SLACK can be removed, which clears the cached Slack member id. ' +
        'The email and password credential is refused with a 400: it is the only way into the account, ' +
        'and the refusal is enforced here rather than left to the canDisconnect flag, which is advisory.',
    }),
    ApiParam({
      name: 'provider',
      description: 'The connection to remove. SLACK is the only one.',
      example: 'SLACK',
    }),
    ApiResponse({ status: 200, type: OwnProfileResponseDto }),
    ...gatedErrors,
    notFound('Slack is not connected to this account'),
  );

export const ApiDeleteOwnAccountDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Delete the caller's own account",
      description:
        'A soft delete: every time entry, work report and audit row references this user, so deletedAt is set rather than the row removed. ' +
        'Every session is destroyed in the same transaction, so there is no window where the account is gone and a live cookie is still accepted. ' +
        "The body must carry the account's own email, which is a deliberate pause on an action with no undo rather than a security control. " +
        'The SYSTEM_ADMIN account is refused: there must always be a root account.',
    }),
    ApiResponse({ status: 200, type: MessageResponseDto }),
    ...gatedErrors,
    notFound('User not found'),
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
