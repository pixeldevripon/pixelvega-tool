import { Module } from '@nestjs/common';
import { SlackModule } from '@/slack/slack.module';
import { DailyWorkReportController } from './daily-work-report.controller';
import { DailyWorkReportService } from './daily-work-report.service';
import { DailyProjectEntryService } from './daily-project-entry.service';
import { ProjectDailyWorkReportsController } from './project-daily-work-reports.controller';

/**
 * Daily plan and wrap up reporting.
 *
 * Two controllers, deliberately: a report spans several projects at once so it
 * cannot be project nested, while the PM view of one project's reports must be.
 */
@Module({
  imports: [SlackModule],
  controllers: [DailyWorkReportController, ProjectDailyWorkReportsController],
  providers: [DailyWorkReportService, DailyProjectEntryService],
  exports: [DailyWorkReportService],
})
export class WorkReportsModule {}
