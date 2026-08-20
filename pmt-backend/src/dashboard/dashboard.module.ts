import { Module } from '@nestjs/common';

import { DashboardController } from '@/dashboard/dashboard.controller';
import { DashboardService } from '@/dashboard/dashboard.service';

/**
 * The landing screen.
 *
 * No imports: `PrismaModule` and the permissions module are `@Global()`, so this
 * module needs neither, and the service reads every table it needs directly
 * rather than depending on eleven feature modules. That is deliberate. Injecting
 * the project, blocker, time entry, leave and work report services would couple
 * one screen to every module in the app and drag their transitive dependencies
 * into it, for aggregate reads none of those services expose anyway.
 *
 * What it MUST NOT do is re-derive a rule those modules own. It imports
 * `compareForDashboard`, `DASHBOARD_ACTIVE_STATUSES`, `daysUntilDeadline`,
 * `TERMINAL_STATUSES` and `withRemainingHours` rather than reimplementing any of
 * them, so an ordering or an overdue definition exists in exactly one place.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
