import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { commonErrors, notFound } from '@/common/swagger/error-sets';
import {
  MarkAllReadResponseDto,
  PaginatedNotificationsResponseDto,
  UnreadCountResponseDto,
} from '@/notifications/dto/notification.dto';

// commonErrors, not gatedErrors: every route here is self scoped, so there is
// no other person's data to be forbidden from and 403 would never be returned.
const selfScopedErrors = commonErrors;

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
    notFound('Not found, or it belongs to someone else'),
  );

export const ApiMarkAllNotificationsReadDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Mark all of the caller's unread notifications read",
    }),
    ApiResponse({ status: 200, type: MarkAllReadResponseDto }),
    ...selfScopedErrors,
  );
