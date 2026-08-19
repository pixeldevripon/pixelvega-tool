import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { PrismaModule } from '@/prisma/prisma.module';
import { UsersModule } from '@/users/users.module';
import { AuthModule } from '@/auth/auth.module';
import { ProfilesModule } from '@/profiles/profiles.module';
import { AuditLogModule } from '@/audit-log/audit-log.module';
import { LeaveModule } from '@/leave/leave.module';
import { ProjectActivityModule } from '@/projects/activity/project-activity.module';
import { ProjectScopeModule } from '@/projects/scope/project-scope.module';
import { ProjectsModule } from '@/projects/projects.module';
import { ProjectStaffingModule } from '@/projects/members/project-staffing.module';
import { ProjectDocumentsModule } from '@/projects/documents/project-documents.module';
import { TimeTrackingModule } from '@/projects/time-entries/time-tracking.module';
import { WorkReportsModule } from '@/projects/daily-work-reports/work-reports.module';
import { BlockersModule } from '@/projects/blockers/blockers.module';
import { ReviewsModule } from '@/projects/reviews/internal/reviews.module';
import { ReportingModule } from '@/projects/reports/reporting.module';
import { SlackModule } from '@/slack/slack.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { auth } from '@/auth/instance/auth.instance';
import { LoginStatusHook } from '@/auth/instance/login-status.hook';
import { PermissionsModule } from '@/auth/permissions/permissions.module';
import { PermissionsGuard } from '@/auth/permissions/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    // @Global(), so every controller can inject PermissionsService without
    // importing this module. See the comment in permissions.module.ts.
    PermissionsModule,
    // AuthModule BEFORE BetterAuthModule: it registers the throttler guard,
    // which has to run before anything queries the database for a session.
    AuthModule,
    BetterAuthModule.forRoot({ auth }),
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
    ProjectStaffingModule,
    ProjectDocumentsModule,
    TimeTrackingModule,
    WorkReportsModule,
    BlockersModule,
    ReviewsModule,
    ReportingModule,
    SlackModule,
  ],
  providers: [
    // The hook better-auth calls on sign-in. It needs Nest DI, so it is
    // provided here rather than inside auth.instance.ts.
    LoginStatusHook,
    // Registered here, not in AuthModule, because Nest processes a module's own
    // providers AFTER every module it imports. That is what puts this LAST in
    // the guard chain, behind AuthGuard, whose request.user it reads.
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
