import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from '@/notifications/dto/query-notifications.dto';

// Always self scoped. Unlike most of ProjectsModule, no staff role ever
// sees anyone else's notifications, there is no company wide or
// PM/Admin-sees-more variant here, so this controller declares no permission
// restriction at all, any authenticated user reads only their own rows.
@ApiTags('Notifications')
@ApiCookieAuth('better-auth.session_token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({
    summary: "List the current user's notifications, newest first",
    description:
      "Paginated. Optional ?unreadOnly=true filter. Always scoped to the caller, there is no way to view another user's notifications through this endpoint regardless of role.",
  })
  @ApiResponse({ status: 200, description: 'Paginated notifications' })
  @Get()
  findAll(
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.notificationsService.findAllForUser(user.id, query);
  }

  @ApiOperation({
    summary: "The current user's unread notification count",
  })
  @ApiResponse({ status: 200, description: 'Unread count' })
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: { id: string; role: Role }) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @ApiOperation({
    summary: 'Mark one notification read',
    description:
      "Only the notification's own recipient can mark it read. Marking an already read notification read again is a harmless no-op.",
  })
  @ApiResponse({ status: 200, description: 'Notification marked read' })
  @ApiResponse({
    status: 404,
    description: 'Notification not found, or belongs to someone else',
  })
  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.notificationsService.markRead(id, user.id);
  }

  @ApiOperation({
    summary: "Mark all of the current user's unread notifications read",
  })
  @ApiResponse({ status: 200, description: 'Count of notifications updated' })
  @Patch('read-all')
  markAllRead(@CurrentUser() user: { id: string; role: Role }) {
    return this.notificationsService.markAllRead(user.id);
  }
}
