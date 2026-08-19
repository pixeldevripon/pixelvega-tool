import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  MarkAllReadResponseDto,
  PaginatedNotificationsResponseDto,
  UnreadCountResponseDto,
} from '@/notifications/dto/notification.dto';

// No 403 set here: every route is self scoped, so there is no other person's
// data to be forbidden from.
const selfScopedErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: BadRequestErrorDto,
  }),
  ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorDto,
  }),
  ApiResponse({ status: 500, type: InternalServerErrorDto }),
];

export const ApiListNotificationsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List the caller's notifications, newest first",
      description:
        'Paginated. Always scoped to the caller: there is no way to read another ' +
        "user's notifications through this endpoint, whatever the role. Pass " +
        'unreadOnly=true for the unread subset.',
    }),
    ApiResponse({ status: 200, type: PaginatedNotificationsResponseDto }),
    ...selfScopedErrors,
  );

export const ApiUnreadCountDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "The caller's unread notification count",
      description:
        'For a badge. Cheaper than fetching the first page to count it.',
    }),
    ApiResponse({ status: 200, type: UnreadCountResponseDto }),
    ...selfScopedErrors,
  );

export const ApiMarkNotificationReadDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mark one notification read',
      description:
        'Only the recipient can mark their own notification read. Marking an already ' +
        'read one is a harmless no-op.',
    }),
    ApiParam({ name: 'id', description: 'The notification id' }),
    ApiResponse({ status: 200, description: 'Marked read' }),
    ...selfScopedErrors,
    ApiResponse({
      status: 404,
      description: 'Not found, or it belongs to someone else',
      type: NotFoundErrorDto,
    }),
  );

export const ApiMarkAllNotificationsReadDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Mark all of the caller's unread notifications read",
    }),
    ApiResponse({ status: 200, type: MarkAllReadResponseDto }),
    ...selfScopedErrors,
  );
