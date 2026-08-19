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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    PrismaModule,
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
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
