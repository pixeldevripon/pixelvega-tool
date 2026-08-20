import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@/prisma/prisma.module';
import { UsersModule } from '@/users/users.module';
import { AuthModule } from '@/auth/auth.module';
import { ProfilesModule } from '@/profiles/profiles.module';
import { AuditLogModule } from '@/audit-logs/audit-log.module';
import { LeaveModule } from '@/leave/leave.module';
import { ProjectActivityModule } from '@/projects/activity/project-activity.module';
import { ProjectScopeModule } from '@/projects/scope/project-scope.module';
import { ProjectsModule } from '@/projects/projects.module';
import { ProjectMembersModule } from '@/projects/members/project-members.module';
import { ProjectDocumentsModule } from '@/projects/documents/project-documents.module';
import { TimeEntriesModule } from '@/projects/time-entries/time-entries.module';
import { DailyWorkReportsModule } from '@/projects/daily-work-reports/daily-work-reports.module';
import { BlockersModule } from '@/projects/blockers/blockers.module';
import { InternalReviewsModule } from '@/projects/reviews/internal/internal-reviews.module';
import { ProjectReportsModule } from '@/projects/reports/project-reports.module';
import { DashboardModule } from '@/dashboard/dashboard.module';
import { ReportsModule } from '@/reports/reports.module';
import { SlackModule } from '@/slack/slack.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { PermissionsModule } from '@/auth/permissions/permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    // @Global(), so every controller can inject PermissionsService without
    // importing this module. See the comment in permissions.module.ts.
    PermissionsModule,
    // Imported early: it registers the throttle guard and the session guard,
    // in that order, and both have to run ahead of PermissionsGuard below.
    AuthModule,
    UsersModule,
    ProfilesModule,
    AuditLogModule,
    NotificationsModule,
    LeaveModule,
    // The project domain, split out of what used to be one ProjectsModule
    // holding seventeen controllers. ProjectActivityModule is @Global, which is
    // what makes the split possible without splitting the activity log.
    ProjectActivityModule,
    ProjectScopeModule,
    ProjectsModule,
    ProjectMembersModule,
    ProjectDocumentsModule,
    TimeEntriesModule,
    DailyWorkReportsModule,
    BlockersModule,
    InternalReviewsModule,
    ProjectReportsModule,
    DashboardModule,
    ReportsModule,
    SlackModule,
  ],
  // No providers. The global guard chain is registered in AuthModule, in one
  // array, because Nest applies the root module's global enhancers BEFORE those
  // of the modules it imports: a guard registered here would run ahead of
  // AuthModule's session guard rather than behind it.
})
export class AppModule {}
