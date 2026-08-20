import { Module } from '@nestjs/common';
import { ProjectTimeEntriesController } from '@/projects/time-entries/project/project-time-entries.controller';
import { ProjectTimeEntriesService } from '@/projects/time-entries/project/project-time-entries.service';
import { TimeEntriesController } from '@/projects/time-entries/time-entries.controller';
import { MeetingTimeEntriesController } from '@/projects/time-entries/meetings/meeting-time-entries.controller';
import { MeetingTimeEntriesService } from '@/projects/time-entries/meetings/meeting-time-entries.service';

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
  controllers: [
    ProjectTimeEntriesController,
    TimeEntriesController,
    MeetingTimeEntriesController,
  ],
  providers: [ProjectTimeEntriesService, MeetingTimeEntriesService],
  exports: [ProjectTimeEntriesService, MeetingTimeEntriesService],
})
export class TimeEntriesModule {}
