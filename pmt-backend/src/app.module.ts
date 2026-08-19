import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { PrismaModule } from '@/prisma/prisma.module';
import { UsersModule } from '@/users/users.module';
import { AuthModule } from '@/auth/auth.module';
import { ProfilesModule } from '@/profiles/profiles.module';
import { AuditLogModule } from '@/audit-log/audit-log.module';
import { LeaveModule } from '@/leave/leave.module';
import { ProjectActivityModule } from '@/project-activity/project-activity.module';
import { ProjectsModule } from '@/projects/projects.module';
import { ProjectStaffingModule } from '@/project-members/project-staffing.module';
import { ProjectDocumentsModule } from '@/project-documents/project-documents.module';
import { TimeTrackingModule } from '@/time-tracking/time-tracking.module';
import { WorkReportsModule } from '@/work-reports/work-reports.module';
import { BlockersModule } from '@/blockers/blockers.module';
import { ReviewsModule } from '@/internal-reviews/reviews.module';
import { ReportingModule } from '@/project-reports/reporting.module';
import { SlackModule } from '@/slack/slack.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { auth } from '@/auth/auth.instance';
import { LoginStatusHook } from '@/auth/login-status.hook';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { PermissionsModule } from '@/auth/permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    PrismaModule,
    // @Global(), so every controller can inject PermissionsService without
    // importing this module. See the comment in permissions.module.ts.
    PermissionsModule,
    BetterAuthModule.forRoot({ auth }),
    UsersModule,
    AuthModule,
    ProfilesModule,
    AuditLogModule,
    NotificationsModule,
    LeaveModule,
    // The project domain, split out of what used to be one ProjectsModule
    // holding seventeen controllers. ProjectActivityModule is @Global, which is
    // what makes the split possible without splitting the activity log.
    ProjectActivityModule,
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
    LoginStatusHook,
    // APP_GUARD providers run in registration order (directive D2):
    //   1. ThrottlerGuard    rate limit before any session lookup
    //   2. AuthGuard         from @thallesp/nestjs-better-auth, registered by
    //                        BetterAuthModule.forRoot() above
    //   3. PermissionsGuard  @RequirePermissions / @RequireAnyPermission
    // Do not reorder: PermissionsGuard reads request.user, which AuthGuard sets.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
