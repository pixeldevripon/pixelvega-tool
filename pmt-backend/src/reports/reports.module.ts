import { Module } from '@nestjs/common';

import { TimeEntriesModule } from '@/projects/time-entries/time-entries.module';
import { DeveloperReportsController } from '@/reports/developers/developer-reports.controller';
import { DeveloperReportService } from '@/reports/developers/developer-report.service';

/**
 * Reports that are not scoped to one project.
 *
 * The developer report answers "how is each person's week going" across every
 * project, so it does not belong under `projects/`, which is where it used to
 * live (`projects/reports/developer/` serving `/reports/developers`, a folder
 * that named neither its route nor its scope). ADR 0004.
 *
 * `TimeEntriesModule` is imported for the hour aggregation.
 */
@Module({
  imports: [TimeEntriesModule],
  controllers: [DeveloperReportsController],
  providers: [DeveloperReportService],
})
export class ReportsModule {}
