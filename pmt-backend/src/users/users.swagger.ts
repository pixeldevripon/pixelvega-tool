import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ConflictErrorDto } from '@/common/dto/error-responses.dto';
import {
  commonErrors,
  gatedErrors,
  notFound,
} from '@/common/swagger/error-sets';
import {
  MessageResponseDto,
  MyPermissionsResponseDto,
  PaginatedUsersResponseDto,
  UserResponseDto,
} from '@/users/dto/user.dto';

/** A route addressing a user by id can also answer 404. */
const targetedErrors = [...gatedErrors, notFound('User not found')];

const userIdParam = ApiParam({
  name: 'id',
  description: 'The user id',
  example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
});

// ── One decorator per endpoint ───────────────────────────────────────────────

export const ApiInviteUserDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Invite a new user',
      description:
        'Creates the account, emails a temporary password, and creates the matching ' +
        'EmployeeProfile or ClientProfile row. The invited user is created INVITED with ' +
        'mustResetPassword true, and flips to ACTIVE on their first successful login. ' +
        'Only SYSTEM_ADMIN may invite an ADMIN.',
    }),
    ApiResponse({
      status: 201,
      description: 'User invited',
      type: UserResponseDto,
    }),
    ...gatedErrors,
    ApiResponse({
      status: 409,
      description: 'Email already in use',
      type: ConflictErrorDto,
    }),
  );

export const ApiChangeOwnPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Change the caller's own password",
      description:
        'Requires the current password. Clears mustResetPassword on success and writes a ' +
        'user.password_changed audit row.',
    }),
    ApiResponse({
      status: 200,
      description: 'Password changed',
      type: MessageResponseDto,
    }),
    ...commonErrors,
  );

export const ApiGetOwnProfileDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Get the caller's own profile" }),
    ApiResponse({
      status: 200,
      description: 'The current user',
      type: UserResponseDto,
    }),
    ...commonErrors,
  );

export const ApiGetOwnPermissionsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Get the caller's effective permissions",
      description:
        'The capability set this session holds, resolved from the caller role. A client ' +
        'gates its UI from this and never derives a capability from the role string, ' +
        'because the mapping lives on the server and can change without the client knowing.',
    }),
    ApiResponse({ status: 200, type: MyPermissionsResponseDto }),
    ...commonErrors,
  );

export const ApiListUsersDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List users',
      description: 'Paginated, newest first. Soft deleted users are excluded.',
    }),
    ApiResponse({ status: 200, type: PaginatedUsersResponseDto }),
    ...gatedErrors,
  );

export const ApiGetUserDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get a user by id' }),
    userIdParam,
    ApiResponse({ status: 200, type: UserResponseDto }),
    ...targetedErrors,
  );

export const ApiUpdateUserDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update a user',
      description:
        'Nobody may change their own role. The SYSTEM_ADMIN account cannot be modified by ' +
        'an ADMIN, one ADMIN cannot edit another, and only SYSTEM_ADMIN may promote anyone ' +
        'to ADMIN. A change that alters nothing writes no audit row.',
    }),
    userIdParam,
    ApiResponse({ status: 200, type: UserResponseDto }),
    ...targetedErrors,
  );

export const ApiDeleteUserDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Soft delete a user',
      description:
        'Sets deletedAt rather than removing the row, so audit history stays intact. The ' +
        'SYSTEM_ADMIN account can never be deleted, and only SYSTEM_ADMIN may delete an ADMIN.',
    }),
    userIdParam,
    ApiResponse({ status: 200, type: MessageResponseDto }),
    ...targetedErrors,
  );
