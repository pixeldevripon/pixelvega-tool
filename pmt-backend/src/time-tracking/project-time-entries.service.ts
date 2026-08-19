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
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { ProjectScopeService } from '@/project-scope/project-scope.service';
import {
  toDailyTimeTotal,
  toMeetingTimeEntryResponse,
  toProjectTimeTotal,
  toTimeEntryResponse,
  toTotals,
  TimeEntryWithRelations,
} from '@/time-tracking/time-entry.mapper';
import { MAX_CONTINUOUS_SESSION_MINUTES } from './time-tracking.constants';
import {
  buildStartedAtFilter,
  getAutoStopCutoff,
  isPreviousUtcDay,
} from './time-entry-date.util';
import {
  QueryTimeEntriesDto,
  TimeEntryNoteDto,
} from '@/time-tracking/dto/time-entry.dto';

const TIME_ENTRY_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
};

// Used only for the cross-table "one timer of any kind" check and the
// combined GET /time-entries/active response below, not for a full
// MeetingTimeEntry feature set — that lives in MeetingTimeEntriesService.
const MEETING_ENTRY_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
};

// One row per running, paused, or stopped segment, not per whole session.
@Injectable()
export class ProjectTimeEntriesService {
  constructor(
    private readonly projectScope: ProjectScopeService,
    private readonly prisma: PrismaService,
    private readonly projectActivity: ProjectActivityService,
  ) {}

  // Not scoped to any one project. The rule that only one timer of any kind
  // (project or meeting) can be active at a time is global, so this is how
  // a caller finds out whether (and what) a timer is already running
  // without needing a project id up front. DEVELOPER/DESIGNER can only
  // check themselves; PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN may pass a
  // requestedUserId to check a specific team member instead.
  async findActiveForUser(
    actorId: string,
    actorRole: Role,
    requestedUserId?: string,
  ) {
    const isStaff = actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER;
    if (requestedUserId && requestedUserId !== actorId && !isStaff) {
      throw new ForbiddenException('You can only check your own active timer');
    }
    const userId = requestedUserId ?? actorId;

    const running = await this.prisma.timeEntry.findFirst({
      where: { userId, status: TimeEntryStatus.RUNNING },
      include: {
        ...TIME_ENTRY_INCLUDE,
        project: { select: { id: true, name: true } },
      },
    });
    // The capabilities are answered for the CALLER, not for the user whose
    // timer this is. A manager checking a developer's timer must be told they
    // cannot stop it, because they cannot.
    const context = { callerId: actorId };

    if (running) {
      // When nothing was auto stopped the returned entry is the one passed in,
      // so `running` is used here: it is the same row and it still carries the
      // project and user relations the narrower helper signature drops.
      const { wasAutoStopped } = await this.autoStopIfExpired(running);
      if (!wasAutoStopped) {
        return {
          active: true,
          kind: 'PROJECT' as const,
          entry: toTimeEntryResponse(running, context),
        };
      }
    }

    const runningMeeting =
      await this.findAndFinalizeRunningMeetingEntry(userId);
    if (runningMeeting) {
      return {
        active: true,
        kind: 'MEETING' as const,
        entry: toMeetingTimeEntryResponse(runningMeeting, context),
      };
    }

    return { active: false, kind: null, entry: null };
  }

  // Spans every project: "which project takes how many hours" for one
  // person, e.g. Jabed: tool internal 24.6h, target board 5h. Anyone can
  // view their own; PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN may pass
  // requestedUserId to view a specific developer/designer instead. Grouped
  // in application code (fetch and Map, same style as findDailySummary())
  // rather than a Prisma groupBy, since we also need each project's name
  // for the response.
  async findProjectSummaryForUser(
    actorId: string,
    actorRole: Role,
    requestedUserId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const isStaff = actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER;
    if (requestedUserId && requestedUserId !== actorId && !isStaff) {
      throw new ForbiddenException(
        'You can only view your own project hours summary',
      );
    }
    const userId = requestedUserId ?? actorId;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const startedAtFilter = buildStartedAtFilter(startDate, endDate);
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        userId,
        durationMinutes: { not: null },
        ...(startedAtFilter && { startedAt: startedAtFilter }),
      },
      select: { projectId: true, durationMinutes: true },
    });

    const minutesByProject = new Map<string, number>();
    for (const entry of entries) {
      const soFar = minutesByProject.get(entry.projectId) ?? 0;
      minutesByProject.set(
        entry.projectId,
        soFar + (entry.durationMinutes ?? 0),
      );
    }

    const projects = await this.prisma.project.findMany({
      where: { id: { in: [...minutesByProject.keys()] } },
      select: { id: true, name: true },
    });
    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

    const projectSummaries = [...minutesByProject.entries()]
      .map(([projectId, totalMinutes]) => ({
        projectId,
        projectName: projectNameById.get(projectId) ?? null,
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    const totalMinutes = projectSummaries.reduce(
      (sum, project) => sum + project.totalMinutes,
      0,
    );

    return {
      userId,
      projects: projectSummaries.map(toProjectTimeTotal),
      ...toTotals(totalMinutes),
    };
  }

  async findAll(
    projectId: string,
    query: QueryTimeEntriesDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.projectScope.assertActiveMember(projectId, actorId, actorRole);

    const {
      page = 1,
      pageSize = 20,
      status,
      startDate,
      endDate,
      userId,
    } = query;
    const startedAtFilter = buildStartedAtFilter(startDate, endDate);

    const where = {
      projectId,
      ...(userId && { userId }),
      ...(status && { status }),
      ...(startedAtFilter && { startedAt: startedAtFilter }),
    };

    const [result, totals] = await Promise.all([
      paginate(
        (args) =>
          this.prisma.timeEntry.findMany({
            where,
            orderBy: { startedAt: 'desc' },
            include: TIME_ENTRY_INCLUDE,
            ...args,
          }),
        () => this.prisma.timeEntry.count({ where }),
        page,
        pageSize,
      ),
      this.prisma.timeEntry.aggregate({
        where,
        _sum: { durationMinutes: true },
      }),
    ]);

    const totalMinutes = totals._sum.durationMinutes ?? 0;
    const context = { callerId: actorId };
    return {
      ...result,
      items: result.items.map((entry) => toTimeEntryResponse(entry, context)),
      ...toTotals(totalMinutes),
    };
  }

  // "Which developer worked how many hours, which day," grouped by the
  // calendar day each segment started (UTC), not split across midnight for
  // a segment that happens to cross it. Only finalized segments count
  // (durationMinutes set on PAUSED/STOPPED). A currently RUNNING segment's
  // time elapsed so far isn't included until it's paused or stopped, the
  // same as actualHours/totalMinutes elsewhere in this module.
  async findDailySummary(
    projectId: string,
    query: QueryTimeEntriesDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.projectScope.assertActiveMember(projectId, actorId, actorRole);

    const { status, startDate, endDate, userId } = query;
    const startedAtFilter = buildStartedAtFilter(startDate, endDate);

    const where = {
      projectId,
      durationMinutes: { not: null },
      ...(userId && { userId }),
      ...(status && { status }),
      ...(startedAtFilter && { startedAt: startedAtFilter }),
    };

    const entries = await this.prisma.timeEntry.findMany({
      where,
      select: { startedAt: true, durationMinutes: true },
    });

    const minutesByDay = new Map<string, number>();
    for (const entry of entries) {
      const day = entry.startedAt.toISOString().slice(0, 10);
      const soFar = minutesByDay.get(day) ?? 0;
      minutesByDay.set(day, soFar + (entry.durationMinutes ?? 0));
    }

    const days = [...minutesByDay.entries()]
      .sort(([dayA], [dayB]) => dayA.localeCompare(dayB))
      .map(([date, totalMinutes]) => ({
        date,
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      }));

    const totalMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0);

    return {
      projectId,
      userId: userId ?? null,
      days: days.map(toDailyTimeTotal),
      ...toTotals(totalMinutes),
    };
  }

  // Cross-project, day-grouped minutes for one user, project side only.
  // Used by MeetingTimeEntriesService.findDailySummaryForUser() to build the
  // "projectMinutes" half of the combined GET /time-entries/daily-summary
  // response. Auth is the caller's responsibility (userId is already
  // resolved by the time this is called), same as findDailyMinutes() on the
  // meeting side.
  async findDailyMinutesForUser(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Map<string, number>> {
    const startedAtFilter = buildStartedAtFilter(startDate, endDate);
    const entries = await this.prisma.timeEntry.findMany({
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

  async start(
    projectId: string,
    dto: TimeEntryNoteDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.projectScope.assertActiveMember(projectId, actorId, actorRole);
    await this.assertNoRunningTimer(actorId);

    // Generated up front (rather than left to the DB default) so the first
    // segment's sessionId can equal its own id.
    const id = randomUUID();
    const entry = await this.prisma.timeEntry.create({
      data: {
        id,
        projectId,
        userId: actorId,
        sessionId: id,
        status: TimeEntryStatus.RUNNING,
        notes: dto.notes,
      },
      include: TIME_ENTRY_INCLUDE,
    });

    await this.projectActivity.log(projectId, actorId, 'TIME_STARTED', {
      message: `${entry.user.name} started tracking time`,
      metadata: { timeEntryId: entry.id },
    });

    return toTimeEntryResponse(entry, { callerId: actorId });
  }

  async pause(
    projectId: string,
    entryId: string,
    dto: TimeEntryNoteDto,
    actorId: string,
  ) {
    const entry = await this.getOwnEntryOrThrow(projectId, entryId, actorId);
    this.assertNotLockedByPreviousDay(entry);
    const { wasAutoStopped } = await this.autoStopIfExpired(entry);
    if (wasAutoStopped) {
      throw new ConflictException(
        `This timer exceeded the ${MAX_CONTINUOUS_SESSION_MINUTES / 60}-hour continuous session limit (or the day it started on has ended) and was automatically stopped — start a new session to continue`,
      );
    }
    if (entry.status !== TimeEntryStatus.RUNNING) {
      throw new BadRequestException('Only a running timer can be paused');
    }

    const endedAt = new Date();
    const updated = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        endedAt,
        durationMinutes: minutesBetween(entry.startedAt, endedAt),
        status: TimeEntryStatus.PAUSED,
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: TIME_ENTRY_INCLUDE,
    });

    await this.recalculateActualHours(projectId);
    await this.projectActivity.log(projectId, actorId, 'TIME_PAUSED', {
      message: `${updated.user.name} paused tracking time`,
      metadata: {
        timeEntryId: updated.id,
        durationMinutes: updated.durationMinutes,
      },
    });

    return toTimeEntryResponse(updated, { callerId: actorId });
  }

  async resume(
    projectId: string,
    entryId: string,
    dto: TimeEntryNoteDto,
    actorId: string,
  ) {
    const entry = await this.getOwnEntryOrThrow(projectId, entryId, actorId);
    this.assertNotLockedByPreviousDay(entry);
    if (entry.status !== TimeEntryStatus.PAUSED) {
      throw new BadRequestException('Only a paused timer can be resumed');
    }

    const supersededBy = await this.prisma.timeEntry.findFirst({
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

    const resumed = await this.prisma.timeEntry.create({
      data: {
        projectId,
        userId: actorId,
        sessionId: entry.sessionId,
        status: TimeEntryStatus.RUNNING,
        notes: dto.notes,
      },
      include: TIME_ENTRY_INCLUDE,
    });

    await this.projectActivity.log(projectId, actorId, 'TIME_RESUMED', {
      message: `${resumed.user.name} resumed tracking time`,
      metadata: { timeEntryId: resumed.id, sessionId: resumed.sessionId },
    });

    return toTimeEntryResponse(resumed, { callerId: actorId });
  }

  async stop(
    projectId: string,
    entryId: string,
    dto: TimeEntryNoteDto,
    actorId: string,
  ) {
    const entry = await this.getOwnEntryOrThrow(projectId, entryId, actorId);
    this.assertNotLockedByPreviousDay(entry);
    // Already over the cap. The caller wanted it stopped anyway, so just
    // hand back the capped result rather than erroring.
    const autoStop = await this.autoStopIfExpired(entry);
    if (autoStop.wasAutoStopped) {
      return toTimeEntryResponse(autoStop.entry, { callerId: actorId });
    }
    const current = autoStop.entry;
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
    // Stopping it just finalizes the status, with no new elapsed time.
    if (current.status === TimeEntryStatus.RUNNING) {
      data.endedAt = new Date();
      data.durationMinutes = minutesBetween(current.startedAt, data.endedAt);
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }

    const updated = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data,
      include: TIME_ENTRY_INCLUDE,
    });

    await this.recalculateActualHours(projectId);
    await this.projectActivity.log(projectId, actorId, 'TIME_STOPPED', {
      message: `${updated.user.name} stopped tracking time`,
      metadata: {
        timeEntryId: updated.id,
        durationMinutes: updated.durationMinutes,
      },
    });

    return toTimeEntryResponse(updated, { callerId: actorId });
  }

  private async getProjectOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async getOwnEntryOrThrow(
    projectId: string,
    entryId: string,
    actorId: string,
  ) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id: entryId, projectId },
    });
    if (!entry) {
      throw new NotFoundException('Time entry not found');
    }
    // Ownership is absolute. A timer is a personal action, not overridable
    // by ADMIN/SYSTEM_ADMIN.
    if (entry.userId !== actorId) {
      throw new ForbiddenException('You can only manage your own time entries');
    }
    return entry;
  }

  // If the user's existing RUNNING timer has already drifted past its
  // cutoff (9 hour cap, or the day it started on has ended), stop it
  // automatically here rather than blocking the new start/resume on a
  // stale session. Also checks MeetingTimeEntry, since only one timer of
  // any kind can be running per person, across both tables.
  private async assertNoRunningTimer(userId: string) {
    const running = await this.prisma.timeEntry.findFirst({
      where: { userId, status: TimeEntryStatus.RUNNING },
    });
    if (running) {
      const { wasAutoStopped } = await this.autoStopIfExpired(running);
      if (!wasAutoStopped) {
        throw new ConflictException(
          `You already have a timer running on project ${running.projectId} — stop or pause it before starting another`,
        );
      }
    }

    const runningMeeting =
      await this.findAndFinalizeRunningMeetingEntry(userId);
    if (runningMeeting) {
      throw new ConflictException(
        'You already have a meeting timer running — stop or pause it before starting a project timer',
      );
    }
  }

  // Public wrapper so MeetingTimeEntriesService can enforce the same
  // cross-table "one timer of any kind" rule from its own start()/resume(),
  // without either service needing to inject the other for the project
  // side's side effects (recalculateActualHours, ProjectActivity logging).
  async assertNoRunningProjectTimer(userId: string) {
    return this.assertNoRunningTimer(userId);
  }

  // A RUNNING MeetingTimeEntry has no project or ProjectActivity to update,
  // so finalizing an expired one here (for the cross-table check above and
  // for GET /time-entries/active) is a plain, side-effect-free Prisma
  // update, duplicated rather than delegated to MeetingTimeEntriesService to
  // avoid a circular dependency between the two services.
  private async findAndFinalizeRunningMeetingEntry(userId: string) {
    const running = await this.prisma.meetingTimeEntry.findFirst({
      where: { userId, status: TimeEntryStatus.RUNNING },
      include: MEETING_ENTRY_INCLUDE,
    });
    if (!running) {
      return null;
    }
    const cutoff = getAutoStopCutoff(running.startedAt);
    if (new Date() < cutoff) {
      return running;
    }

    await this.prisma.meetingTimeEntry.update({
      where: { id: running.id },
      data: {
        status: TimeEntryStatus.STOPPED,
        endedAt: cutoff,
        durationMinutes: minutesBetween(running.startedAt, cutoff),
      },
    });
    return null;
  }

  // A RUNNING entry from a previous day is caught by autoStopIfExpired's
  // day boundary cutoff before this would matter, it gets finalized as
  // STOPPED rather than blocked. This mostly guards a PAUSED entry left
  // over from a previous day, since its durationMinutes is already fixed
  // and there is nothing for autoStopIfExpired to do with it. Once the day
  // has passed, a segment that started on it can no longer be paused,
  // resumed, or stopped by hand.
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

  // Enforces "a single continuous work session cannot exceed 9 hours," and
  // "a segment must be finished the same UTC day it started." Only a
  // RUNNING entry can still be accumulating elapsed time (a PAUSED one
  // already has its clock stopped), so this only ever acts on RUNNING
  // entries. Checked lazily whenever a RUNNING entry is next touched (its
  // own pause/stop, or the owner's next start/resume attempt) rather than
  // via a background job. Discards any time worked beyond the cutoff,
  // whichever of the two came first, not the real elapsed time.
  //
  // The return is a discriminated union rather than one shape, because the two
  // branches genuinely differ: when nothing was stopped the caller gets back
  // exactly the row it passed in, relations and all, and when something WAS
  // stopped the row is a fresh read that only carries TIME_ENTRY_INCLUDE. A
  // single shape would have to narrow both to the smaller one, which is what
  // previously stripped the project relation off an entry on its way to a
  // response.
  private async autoStopIfExpired<
    T extends {
      id: string;
      projectId: string;
      userId: string;
      status: TimeEntryStatus;
      startedAt: Date;
    },
  >(
    entry: T,
  ): Promise<
    | { entry: T; wasAutoStopped: false }
    | { entry: TimeEntryWithRelations; wasAutoStopped: true }
  > {
    if (entry.status !== TimeEntryStatus.RUNNING) {
      return { entry, wasAutoStopped: false as const };
    }
    const cutoff = getAutoStopCutoff(entry.startedAt);
    if (new Date() < cutoff) {
      return { entry, wasAutoStopped: false as const };
    }

    const stopped = await this.prisma.timeEntry.update({
      where: { id: entry.id },
      data: {
        status: TimeEntryStatus.STOPPED,
        endedAt: cutoff,
        durationMinutes: minutesBetween(entry.startedAt, cutoff),
      },
      include: TIME_ENTRY_INCLUDE,
    });

    await this.recalculateActualHours(entry.projectId);
    await this.projectActivity.log(
      entry.projectId,
      entry.userId,
      'TIME_AUTO_STOPPED',
      {
        message: isPreviousUtcDay(entry.startedAt)
          ? `${stopped.user.name}'s timer was automatically stopped at the end of the day it started on`
          : `${stopped.user.name}'s timer was automatically stopped after exceeding the ${MAX_CONTINUOUS_SESSION_MINUTES / 60}-hour continuous session limit`,
        metadata: { timeEntryId: stopped.id },
      },
    );

    return { entry: stopped, wasAutoStopped: true as const };
  }

  private async recalculateActualHours(projectId: string) {
    const { _sum } = await this.prisma.timeEntry.aggregate({
      where: { projectId, endedAt: { not: null } },
      _sum: { durationMinutes: true },
    });
    await this.prisma.project.update({
      where: { id: projectId },
      data: { actualHours: (_sum.durationMinutes ?? 0) / 60 },
    });
  }
}
