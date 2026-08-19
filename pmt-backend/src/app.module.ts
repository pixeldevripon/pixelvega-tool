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
import { ProjectsModule } from '@/projects/projects.module';
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
    ProjectsModule,
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
