import { Global, Module } from '@nestjs/common';
import { SlackModule } from '../slack/slack.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsSchedulerService } from './notifications-scheduler.service';

// @Global(), same pattern as AuditLogModule: almost every existing module
// (ProjectsModule, LeaveModule, ...) needs to inject NotificationsService
// to call notify() at the point something actually happens, so it is
// available everywhere without each of those modules importing this one.
// Imports SlackModule for the optional Slack DM channel and the deadline
// reminder's project channel post, a one directional dependency,
// SlackModule has no dependency back on this module, so there is no
// circularity risk the way there was between AiModule and ProjectsModule.
// ScheduleModule itself is registered once in AppModule, not here, the
// @Cron() decorator on NotificationsSchedulerService's methods is all
// this module needs.
@Global()
@Module({
  imports: [SlackModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsSchedulerService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
