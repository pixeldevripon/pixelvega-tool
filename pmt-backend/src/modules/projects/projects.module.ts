import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { SlackModule } from '../slack/slack.module';
import { AiModule } from '../ai/ai.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectActivityService } from './project-activity.service';
import { ProjectMembersController } from './members/project-members.controller';
import { ProjectMembersService } from './members/project-members.service';
import { ProjectDocumentsController } from './documents/project-documents.controller';
import { ProjectDocumentsService } from './documents/project-documents.service';
import { ProjectTimeEntriesController } from './time-tracking/project-time-entries.controller';
import { ProjectTimeEntriesService } from './time-tracking/project-time-entries.service';
import { TimeEntriesController } from './time-tracking/time-entries.controller';
import { MeetingTimeEntriesService } from './time-tracking/meeting-time-entries.service';
import { AdditionalRequirementsController } from './additional-requirements/additional-requirements.controller';
import { AdditionalRequirementsService } from './additional-requirements/additional-requirements.service';
import { DailyWorkReportController } from './daily-work-reports/daily-work-report.controller';
import { DailyWorkReportService } from './daily-work-reports/daily-work-report.service';
import { DailyProjectEntryService } from './daily-work-reports/daily-project-entry.service';
import { ProjectDailyWorkReportsController } from './daily-work-reports/project-daily-work-reports.controller';
import { BlockersController } from './blockers/blockers.controller';
import { ProjectBlockersController } from './blockers/project-blockers.controller';
import { BlockerService } from './blockers/blocker.service';
import { BlockerReasonsController } from './blockers/blocker-reasons.controller';
import { BlockerReasonsService } from './blockers/blocker-reasons.service';
import { InternalReviewsController } from './internal-reviews/internal-reviews.controller';
import { InternalReviewsService } from './internal-reviews/internal-reviews.service';
import { ClientFeedbackController } from './client-feedback/client-feedback.controller';
import { ClientFeedbackService } from './client-feedback/client-feedback.service';
import { ProjectReportsController } from './reports/project-reports.controller';
import { ProjectReportService } from './reports/project-report.service';
import { DeveloperReportsController } from './reports/developer-reports.controller';
import { DeveloperReportService } from './reports/developer-report.service';
import { ProjectAiSummaryController } from './ai-summary/project-ai-summary.controller';
import { ProjectAiSummaryService } from './ai-summary/project-ai-summary.service';
import { ProjectStatusReportsController } from './ai-status-reports/project-status-reports.controller';
import { ProjectStatusReportsService } from './ai-status-reports/project-status-reports.service';

@Module({
  imports: [UploadsModule, SlackModule, AiModule],
  controllers: [
    ProjectsController,
    ProjectMembersController,
    ProjectDocumentsController,
    ProjectTimeEntriesController,
    TimeEntriesController,
    AdditionalRequirementsController,
    DailyWorkReportController,
    ProjectDailyWorkReportsController,
    BlockersController,
    ProjectBlockersController,
    BlockerReasonsController,
    InternalReviewsController,
    ClientFeedbackController,
    ProjectReportsController,
    DeveloperReportsController,
    ProjectAiSummaryController,
    ProjectStatusReportsController,
  ],
  providers: [
    ProjectsService,
    ProjectActivityService,
    ProjectMembersService,
    ProjectDocumentsService,
    ProjectTimeEntriesService,
    MeetingTimeEntriesService,
    AdditionalRequirementsService,
    DailyWorkReportService,
    DailyProjectEntryService,
    BlockerService,
    BlockerReasonsService,
    InternalReviewsService,
    ClientFeedbackService,
    ProjectReportService,
    DeveloperReportService,
    ProjectAiSummaryService,
    ProjectStatusReportsService,
  ],
})
export class ProjectsModule {}
