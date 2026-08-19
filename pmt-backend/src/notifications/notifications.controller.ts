import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { QueryNotificationsDto } from '@/notifications/dto/notification.dto';
import {
  ApiListNotificationsDocs,
  ApiMarkAllNotificationsReadDocs,
  ApiMarkNotificationReadDocs,
  ApiUnreadCountDocs,
} from './notifications.swagger';
import { NotificationsService } from './notifications.service';

/**
 * Routing only. Documentation lives in notifications.swagger.ts.
 *
 * Every route here is self scoped. Unlike most of the project domain there is
 * no company wide or PM-sees-more variant: no role ever reads another person's
 * notifications, so the permissions are the self service ones every role holds.
 * Static routes are declared above dynamic ones.
 */
@ApiTags('Notifications')
@ApiCookieAuth('better-auth.session_token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiListNotificationsDocs()
  @RequirePermissions(Permission.VIEW_OWN_NOTIFICATIONS)
  @Get()
  findAll(
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.notificationsService.findAllForUser(user.id, query);
  }

  @ApiUnreadCountDocs()
  @RequirePermissions(Permission.VIEW_OWN_NOTIFICATIONS)
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @ApiMarkAllNotificationsReadDocs()
  @RequirePermissions(Permission.MANAGE_OWN_NOTIFICATIONS)
  @Patch('read-all')
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllRead(user.id);
  }

  @ApiMarkNotificationReadDocs()
  @RequirePermissions(Permission.MANAGE_OWN_NOTIFICATIONS)
  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.notificationsService.markRead(id, user.id);
  }
}
