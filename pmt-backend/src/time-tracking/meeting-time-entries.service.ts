import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Role, TimeEntryStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination.util';
import { minutesBetween } from '@/common/utils/date.util';
import { ProjectTimeEntriesService } from './project-time-entries.service';
import { TimeEntryNoteDto } from '@/time-tracking/dto/time-entry-note.dto';
import { QueryMeetingTimeEntriesDto } from '@/time-tracking/dto/query-meeting-time-entries.dto';
import {
  buildStartedAtFilter,
  getAutoStopCutoff,
  isPreviousUtcDay,
} from './time-entry-date.util';

const MEETING_ENTRY_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
};

// Time not spent on any project, office meetings for now. Mirrors
// ProjectTimeEntriesService's segment based start/pause/resume/stop nearly
// line for line, minus anything project or ProjectActivity related since
// there is no project to log an activity against. Depends on
// ProjectTimeEntriesService one way only (to enforce the shared "one timer
// of any kind" rule against TimeEntry with its real side effects intact,
// recalculateActualHours/ProjectActivity logging), so the two services
// don't end up injecting each other.
@Injectable()
export class MeetingTimeEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectTimeEntriesService: ProjectTimeEntriesService,
  ) {}

  async findAll(
    query: QueryMeetingTimeEntriesDto,
    actorId: string,
    actorRole: Role,
  ) {
    const isStaff = actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER;
    if (query.userId && query.userId !== actorId && !isStaff) {
      throw new ForbiddenException(
        'You can only list your own meeting entries',
      );
    }
    const userId = query.userId ?? actorId;

    const { page = 1, pageSize = 20, status, startDate, endDate } = query;
    const startedAtFilter = buildStartedAtFilter(startDate, endDate);

    const where = {
      userId,
      ...(status && { status }),
      ...(startedAtFilter && { startedAt: startedAtFilter }),
    };

    const [result, totals] = await Promise.all([
      paginate(
        (args) =>
          this.prisma.meetingTimeEntry.findMany({
            where,
            orderBy: { startedAt: 'desc' },
            include: MEETING_ENTRY_INCLUDE,
            ...args,
          }),
        () => this.prisma.meetingTimeEntry.count({ where }),
        page,
        pageSize,
      ),
      this.prisma.meetingTimeEntry.aggregate({
        where,
        _sum: { durationMinutes: true },
      }),
    ]);

    const totalMinutes = totals._sum.durationMinutes ?? 0;
    return {
      ...result,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    };
  }

  // The combined view that answers the original ask: project hours next to
  // meeting hours, day by day. Self scoped for DEVELOPER/DESIGNER;
  // PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN may pass a requestedUserId to view
  // anyone. Merges ProjectTimeEntriesService.findDailyMinutesForUser() (the
  // project side) with this service's own findDailyMinutes() (the meeting
  // side) keyed by the same UTC calendar day.
  async findDailySummaryForUser(
    actorId: string,
    actorRole: Role,
    requestedUserId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const isStaff = actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER;
    if (requestedUserId && requestedUserId !== actorId && !isStaff) {
      throw new ForbiddenException(
        'You can only view your own daily time summary',
      );
    }
    const userId = requestedUserId ?? actorId;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [projectMinutesByDay, meetingMinutesByDay] = await Promise.all([
      this.projectTimeEntriesService.findDailyMinutesForUser(
        userId,
        startDate,
        endDate,
      ),
      this.findDailyMinutes(userId, startDate, endDate),
    ]);

    const allDays = new Set([
      ...projectMinutesByDay.keys(),
      ...meetingMinutesByDay.keys(),
    ]);

    const days = [...allDays].sort().map((date) => {
      const projectMinutes = projectMinutesByDay.get(date) ?? 0;
      const meetingMinutes = meetingMinutesByDay.get(date) ?? 0;
      return {
        date,
        projectMinutes,
        meetingMinutes,
        totalMinutes: projectMinutes + meetingMinutes,
      };
    });

    const totalProjectMinutes = days.reduce(
      (sum, day) => sum + day.projectMinutes,
      0,
    );
    const totalMeetingMinutes = days.reduce(
      (sum, day) => sum + day.meetingMinutes,
      0,
    );

    return {
      userId,
      days,
      totalProjectMinutes,
      totalMeetingMinutes,
      totalMinutes: totalProjectMinutes + totalMeetingMinutes,
    };
  }

  // Meeting side of findDailySummaryForUser() above. Only finalized rows
  // count, same convention as findProjectSummaryForUser/findDailySummary on
  // the project side.
  private async findDailyMinutes(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Map<string, number>> {
    const startedAtFilter = buildStartedAtFilter(startDate, endDate);
    const entries = await this.prisma.meetingTimeEntry.findMany({
      where: {
        userId,
        durationMinutes: { not: null },
        ...(startedAtFilter && { startedAt: startedAtFilter }),
      },
      select: { startedAt: true, durationMinutes: true },
    });

    const minutesByDay = new Map<string, number>();
    for (const entry of entries) {
      const day = entry.startedAt.toISOString().slice(0, 10);
      const soFar = minutesByDay.get(day) ?? 0;
      minutesByDay.set(day, soFar + (entry.durationMinutes ?? 0));
    }
    return minutesByDay;
  }

  async start(dto: TimeEntryNoteDto, actorId: string) {
    await this.assertNoRunningTimer(actorId);

    // Generated up front (rather than left to the DB default) so the first
    // segment's sessionId can equal its own id, same pattern as TimeEntry.
    const id = randomUUID();
    return this.prisma.meetingTimeEntry.create({
      data: {
        id,
        userId: actorId,
        sessionId: id,
        status: TimeEntryStatus.RUNNING,
        notes: dto.notes,
      },
      include: MEETING_ENTRY_INCLUDE,
    });
  }

  async pause(entryId: string, dto: TimeEntryNoteDto, actorId: string) {
    const entry = await this.getOwnEntryOrThrow(entryId, actorId);
    this.assertNotLockedByPreviousDay(entry);
    const { wasAutoStopped } = await this.autoStopIfExpired(entry);
    if (wasAutoStopped) {
      throw new ConflictException(
        'This timer exceeded the continuous session limit (or the day it started on has ended) and was automatically stopped, start a new session to continue',
      );
    }
    if (entry.status !== TimeEntryStatus.RUNNING) {
      throw new BadRequestException('Only a running timer can be paused');
    }

    const endedAt = new Date();
    return this.prisma.meetingTimeEntry.update({
      where: { id: entryId },
      data: {
        endedAt,
        durationMinutes: minutesBetween(entry.startedAt, endedAt),
        status: TimeEntryStatus.PAUSED,
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: MEETING_ENTRY_INCLUDE,
    });
  }

  async resume(entryId: string, dto: TimeEntryNoteDto, actorId: string) {
    const entry = await this.getOwnEntryOrThrow(entryId, actorId);
    this.assertNotLockedByPreviousDay(entry);
    if (entry.status !== TimeEntryStatus.PAUSED) {
      throw new BadRequestException('Only a paused timer can be resumed');
    }

    const supersededBy = await this.prisma.meetingTimeEntry.findFirst({
      where: {
        sessionId: entry.sessionId,
        startedAt: { gt: entry.startedAt },
      },
    });
    if (supersededBy) {
      throw new ConflictException(
        'This paused segment has already been superseded by a later resume',
      );
    }

    await this.assertNoRunningTimer(actorId);

    return this.prisma.meetingTimeEntry.create({
      data: {
        userId: actorId,
        sessionId: entry.sessionId,
        status: TimeEntryStatus.RUNNING,
        notes: dto.notes,
      },
      include: MEETING_ENTRY_INCLUDE,
    });
  }

  async stop(entryId: string, dto: TimeEntryNoteDto, actorId: string) {
    const entry = await this.getOwnEntryOrThrow(entryId, actorId);
    this.assertNotLockedByPreviousDay(entry);
    // Already over the cap. The caller wanted it stopped anyway, so just
    // hand back the capped result rather than erroring.
    const { entry: current, wasAutoStopped } =
      await this.autoStopIfExpired(entry);
    if (wasAutoStopped) {
      return current;
    }
    if (current.status === TimeEntryStatus.STOPPED) {
      throw new BadRequestException('This timer has already been stopped');
    }

    const data: {
      status: TimeEntryStatus;
      endedAt?: Date;
      durationMinutes?: number;
      notes?: string;
    } = { status: TimeEntryStatus.STOPPED };

    // A PAUSED entry already has endedAt/durationMinutes set from the pause.
    if (current.status === TimeEntryStatus.RUNNING) {
      data.endedAt = new Date();
      data.durationMinutes = minutesBetween(current.startedAt, data.endedAt);
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }

    return this.prisma.meetingTimeEntry.update({
      where: { id: entryId },
      data,
      include: MEETING_ENTRY_INCLUDE,
    });
  }

  private async getOwnEntryOrThrow(entryId: string, actorId: string) {
    const entry = await this.prisma.meetingTimeEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry) {
      throw new NotFoundException('Meeting time entry not found');
    }
    // Ownership is absolute, same as TimeEntry, never overridable by
    // ADMIN/SYSTEM_ADMIN.
    if (entry.userId !== actorId) {
      throw new ForbiddenException(
        'You can only manage your own meeting entries',
      );
    }
    return entry;
  }

  // Rejects if the caller already has a RUNNING row in either this table or
  // TimeEntry, the same global "one timer of any kind" rule TimeEntry
  // enforces from its own side. The TimeEntry side is delegated to
  // ProjectTimeEntriesService so its side effects (recalculateActualHours,
  // ProjectActivity logging) stay in one place.
  private async assertNoRunningTimer(userId: string) {
    await this.projectTimeEntriesService.assertNoRunningProjectTimer(userId);

    const running = await this.prisma.meetingTimeEntry.findFirst({
      where: { userId, status: TimeEntryStatus.RUNNING },
    });
    if (!running) {
      return;
    }
    const { wasAutoStopped } = await this.autoStopIfExpired(running);
    if (!wasAutoStopped) {
      throw new ConflictException(
        'You already have a meeting timer running, stop or pause it before starting another',
      );
    }
  }

  // A RUNNING entry from a previous day is caught by autoStopIfExpired's
  // day boundary cutoff before this would matter. This mostly guards a
  // PAUSED entry left over from a previous day, since its durationMinutes
  // is already fixed and there is nothing for autoStopIfExpired to do with
  // it. Same reasoning as ProjectTimeEntriesService's copy of this check.
  private assertNotLockedByPreviousDay(entry: {
    status: TimeEntryStatus;
    startedAt: Date;
  }) {
    if (
      entry.status === TimeEntryStatus.PAUSED &&
      isPreviousUtcDay(entry.startedAt)
    ) {
      throw new ConflictException(
        'This entry started on a previous day and can no longer be edited',
      );
    }
  }

  // Enforces the same 9 hour continuous session cap and same day
  // completion rule as ProjectTimeEntriesService's copy, minus
  // recalculateActualHours/ProjectActivity since there is no project here.
  private async autoStopIfExpired(entry: {
    id: string;
    userId: string;
    status: TimeEntryStatus;
    startedAt: Date;
  }) {
    if (entry.status !== TimeEntryStatus.RUNNING) {
      return { entry, wasAutoStopped: false };
    }
    const cutoff = getAutoStopCutoff(entry.startedAt);
    if (new Date() < cutoff) {
      return { entry, wasAutoStopped: false };
    }

    const stopped = await this.prisma.meetingTimeEntry.update({
      where: { id: entry.id },
      data: {
        status: TimeEntryStatus.STOPPED,
        endedAt: cutoff,
        durationMinutes: minutesBetween(entry.startedAt, cutoff),
      },
      include: MEETING_ENTRY_INCLUDE,
    });

    return { entry: stopped, wasAutoStopped: true };
  }
}
