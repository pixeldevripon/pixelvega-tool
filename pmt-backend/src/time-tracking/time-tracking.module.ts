import { Module } from '@nestjs/common';
import { ProjectTimeEntriesController } from './project-time-entries.controller';
import { ProjectTimeEntriesService } from './project-time-entries.service';
import { TimeEntriesController } from './time-entries.controller';
import { MeetingTimeEntriesService } from './meeting-time-entries.service';

/**
 * Project and meeting time segments.
 *
 * Both services live here together on purpose: the "only one timer of any kind
 * per person" rule spans both tables, and MeetingTimeEntriesService enforces its
 * half by calling into ProjectTimeEntriesService. Splitting them would need a
 * circular import.
 *
 * Both are exported because the reporting module aggregates over them.
 */
@Module({
  controllers: [ProjectTimeEntriesController, TimeEntriesController],
  providers: [ProjectTimeEntriesService, MeetingTimeEntriesService],
  exports: [ProjectTimeEntriesService, MeetingTimeEntriesService],
})
export class TimeTrackingModule {}
