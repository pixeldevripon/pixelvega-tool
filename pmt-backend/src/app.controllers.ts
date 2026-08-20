/**
 * Every controller class in the app, in one list.
 *
 * Nest never needs this: each module registers its own controllers. It
 * exists because two specs pin properties of the WHOLE route surface, and
 * both need the same list to do it. `route-permissions.spec.ts` pins which
 * permission gates each route, and `route-params.spec.ts` pins that every
 * documented path parameter is the one the route actually takes. A list that
 * lived in one of them could not be reused by the other without importing a
 * spec from a spec, and a second copy would drift.
 *
 * A new controller belongs here as well as in its module. Both specs assert
 * the length, so forgetting shows up as a failure rather than as silently
 * reduced coverage.
 */
import { AdditionalRequirementsController } from '@/projects/requirements/additional/additional-requirements.controller';
import { AiJobsController } from '@/ai/jobs/ai-jobs.controller';
import { AiTemplatesController } from '@/ai/templates/ai-templates.controller';
import { ProjectStatusReportsController } from '@/projects/ai/status-reports/project-status-reports.controller';
import { ProjectAiSummaryController } from '@/projects/ai/summary/project-ai-summary.controller';
import { AuditLogController } from '@/audit-logs/audit-log.controller';
import { BlockerReasonsController } from '@/projects/blockers/reasons/blocker-reasons.controller';
import { BlockersController } from '@/projects/blockers/blockers.controller';
import { ProjectBlockersController } from '@/projects/blockers/project-blockers.controller';
import { ClientFeedbackController } from '@/projects/reviews/client/client-feedback.controller';
import { InternalReviewsController } from '@/projects/reviews/internal/internal-reviews.controller';
import { HolidaysController } from '@/leave/holidays/holidays.controller';
import { LeaveRequestsController } from '@/leave/requests/leave-requests.controller';
import { LeaveBalancesController } from '@/leave/balances/leave-balances.controller';
import { LeaveTypesController } from '@/leave/types/leave-types.controller';
import { NotificationsController } from '@/notifications/notifications.controller';
import { ProfilesController } from '@/profiles/profiles.controller';
import { ProjectDocumentsController } from '@/projects/documents/project-documents.controller';
import { ProjectMembersController } from '@/projects/members/project-members.controller';
import { DeveloperReportsController } from '@/reports/developers/developer-reports.controller';
import { ProjectReportsController } from '@/projects/reports/project/project-reports.controller';
import { ProjectsController } from '@/projects/projects.controller';
import { ProjectTimeEntriesController } from '@/projects/time-entries/project/project-time-entries.controller';
import { TimeEntriesController } from '@/projects/time-entries/time-entries.controller';
import { MeetingTimeEntriesController } from '@/projects/time-entries/meetings/meeting-time-entries.controller';
import { UsersController } from '@/users/users.controller';
import { DailyWorkReportController } from '@/projects/daily-work-reports/daily-work-report.controller';
import { ProjectDailyWorkReportsController } from '@/projects/daily-work-reports/project-daily-work-reports.controller';

export const ALL_CONTROLLERS = [
  AdditionalRequirementsController,
  AiJobsController,
  AiTemplatesController,
  ProjectStatusReportsController,
  ProjectAiSummaryController,
  AuditLogController,
  BlockerReasonsController,
  BlockersController,
  ProjectBlockersController,
  ClientFeedbackController,
  InternalReviewsController,
  HolidaysController,
  LeaveRequestsController,
  LeaveBalancesController,
  LeaveTypesController,
  NotificationsController,
  ProfilesController,
  ProjectDocumentsController,
  ProjectMembersController,
  DeveloperReportsController,
  ProjectReportsController,
  ProjectsController,
  ProjectTimeEntriesController,
  TimeEntriesController,
  MeetingTimeEntriesController,
  UsersController,
  DailyWorkReportController,
  ProjectDailyWorkReportsController,
];
