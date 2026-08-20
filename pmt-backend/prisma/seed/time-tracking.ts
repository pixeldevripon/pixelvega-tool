import type { PrismaClient } from '@prisma/client';
import { ProjectRole, TimeEntryStatus, UserStatus } from '@prisma/client';
import { SEED_TODAY, VOLUME } from './config';
import {
  Rand,
  addDays,
  addMinutes,
  atUtcTime,
  isFriday,
  utcDateOnly,
} from './random';
import { MEETING_NOTES, TIME_ENTRY_NOTES } from './pools';
import type { SeededProject } from './projects';
import type { SeededUsers } from './users';

// Matches MAX_CONTINUOUS_SESSION_MINUTES in time-tracking.constants.ts. A
// single running stretch is never allowed past this, so no seeded segment goes
// over it either.
const MAX_CONTINUOUS_SESSION_MINUTES = 9 * 60;

// A segment has to start and finish inside the same UTC calendar day. Work is
// generated inside this window so that always holds.
const EARLIEST_START_HOUR = 3; // 9 AM Dhaka time
const LATEST_END_HOUR = 21;

export type SeededTimeTracking = {
  timeEntryCount: number;
  meetingEntryCount: number;
  /** Minutes per project across every segment that has ended. */
  projectMinutes: Map<string, number>;
};

type Eligibility = { projectId: string; from: Date; to: Date };

export async function seedTimeTracking(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
): Promise<SeededTimeTracking> {
  const projectMinutes = new Map<string, number>();
  const timeEntryRows: any[] = [];
  const meetingRows: any[] = [];

  // Which projects each developer or designer could have logged time against,
  // and between which dates. Someone who left a project cannot have logged
  // time after their leftAt date.
  const workerProjects = new Map<string, Eligibility[]>();
  for (const project of projects) {
    const projectEnd = project.completedAt ?? SEED_TODAY;
    for (const member of project.members) {
      if (member.role === ProjectRole.PROJECT_MANAGER) continue;
      const to = member.leftAt ?? projectEnd;
      if (to.getTime() <= member.joinedAt.getTime()) continue;
      const list = workerProjects.get(member.userId) ?? [];
      list.push({ projectId: project.id, from: member.joinedAt, to });
      workerProjects.set(member.userId, list);
    }
  }

  const workerIds = [...workerProjects.keys()];
  const meetingAttendees = users.workforce.map((user) => user.id);

  // Walk backwards day by day and generate a normal workday of segments.
  for (let dayOffset = VOLUME.timeTrackingDays; dayOffset >= 1; dayOffset--) {
    const day = utcDateOnly(addDays(SEED_TODAY, -dayOffset));
    if (isFriday(day)) continue; // Friday is the weekly off day

    // Project work. The test developer and designer are always included, so
    // those two logins always have hours to look at.
    const sampledWorkers = withGuaranteed(
      rand.sample(workerIds, VOLUME.workersLoggingTimePerDay),
      [users.test.developer.id, users.test.designer.id],
      workerIds,
    );

    for (const workerId of sampledWorkers) {
      const eligible = (workerProjects.get(workerId) ?? []).filter(
        (item) =>
          item.from.getTime() <= day.getTime() &&
          day.getTime() <= item.to.getTime(),
      );
      if (eligible.length === 0) continue;

      // Most people touch one project a day, some split across two.
      const chosen = rand.sample(eligible, rand.chance(0.25) ? 2 : 1);
      let cursorHour = EARLIEST_START_HOUR + rand.int(0, 2);

      for (const item of chosen) {
        const built = buildSession(rand, day, cursorHour, {
          notesPool: TIME_ENTRY_NOTES,
        });
        if (!built) continue;
        cursorHour = built.endHour + 1;

        for (const segment of built.segments) {
          timeEntryRows.push({
            id: segment.id,
            projectId: item.projectId,
            userId: workerId,
            sessionId: built.sessionId,
            status: segment.status,
            notes: segment.notes,
            startedAt: segment.startedAt,
            endedAt: segment.endedAt,
            durationMinutes: segment.durationMinutes,
            createdAt: segment.startedAt,
            updatedAt: segment.endedAt ?? segment.startedAt,
          });
          if (segment.endedAt && segment.durationMinutes !== null) {
            projectMinutes.set(
              item.projectId,
              (projectMinutes.get(item.projectId) ?? 0) +
                segment.durationMinutes,
            );
          }
        }
      }
    }

    // Meeting time. Project managers are included here even though they are
    // excluded from project time tracking, since sitting in standups and
    // planning is part of their job.
    const sampledAttendees = withGuaranteed(
      rand.sample(meetingAttendees, VOLUME.meetingAttendeesPerDay),
      [
        users.test.projectManager.id,
        users.test.developer.id,
        users.test.designer.id,
      ],
      meetingAttendees,
    );

    for (const attendeeId of sampledAttendees) {
      const built = buildSession(rand, day, EARLIEST_START_HOUR, {
        notesPool: MEETING_NOTES,
        shortSession: true,
      });
      if (!built) continue;

      for (const segment of built.segments) {
        meetingRows.push({
          id: segment.id,
          userId: attendeeId,
          sessionId: built.sessionId,
          status: segment.status,
          notes: segment.notes,
          startedAt: segment.startedAt,
          endedAt: segment.endedAt,
          durationMinutes: segment.durationMinutes,
          createdAt: segment.startedAt,
          updatedAt: segment.endedAt ?? segment.startedAt,
        });
      }
    }
  }

  // Live timers. These use the real clock rather than the fixed seed date, so
  // they are genuinely still running whenever the seed is executed. Only one
  // timer of any kind may run per person, across both tables, so the two
  // groups below never share a user.
  //
  // Only an active account can hold a live timer. Someone still sitting on an
  // invite has never signed in, and a suspended person is not at work, so
  // neither could have a timer running right now. Past segments for those two
  // are fine, people do get suspended after doing real work.
  const activeUserIds = new Set(
    users.employees
      .filter((user) => user.status === UserStatus.ACTIVE)
      .map((user) => user.id),
  );
  const runningNow = pickLiveTimerUsers(
    rand,
    workerIds.filter((id) => activeUserIds.has(id)),
    meetingAttendees.filter((id) => activeUserIds.has(id)),
  );

  for (const userId of runningNow.projectTimers) {
    const eligible = workerProjects.get(userId) ?? [];
    if (eligible.length === 0) continue;
    const item = rand.pick(eligible);
    const startedAt = liveTimerStart(rand);
    const id = rand.uuid();
    timeEntryRows.push({
      id,
      projectId: item.projectId,
      userId,
      sessionId: id, // the first segment's sessionId is its own id
      status: TimeEntryStatus.RUNNING,
      notes: rand.pick(TIME_ENTRY_NOTES),
      startedAt,
      // A RUNNING segment has neither an end nor a duration yet.
      endedAt: null,
      durationMinutes: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    });
  }

  for (const userId of runningNow.meetingTimers) {
    const startedAt = liveTimerStart(rand);
    const id = rand.uuid();
    meetingRows.push({
      id,
      userId,
      sessionId: id,
      status: TimeEntryStatus.RUNNING,
      notes: rand.pick(MEETING_NOTES),
      startedAt,
      endedAt: null,
      durationMinutes: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    });
  }

  await prisma.timeEntry.createMany({ data: timeEntryRows });
  await prisma.meetingTimeEntry.createMany({ data: meetingRows });

  return {
    timeEntryCount: timeEntryRows.length,
    meetingEntryCount: meetingRows.length,
    projectMinutes,
  };
}

// Adds the must have ids to a random sample, without duplicating anyone and
// without including someone who is not eligible in the first place.
function withGuaranteed(
  sampled: string[],
  required: string[],
  eligible: string[],
): string[] {
  const eligibleSet = new Set(eligible);
  const out = new Set(sampled);
  for (const id of required) {
    if (eligibleSet.has(id)) out.add(id);
  }
  return [...out];
}

type BuiltSegment = {
  id: string;
  status: TimeEntryStatus;
  notes: string | null;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
};

type BuiltSession = {
  sessionId: string;
  segments: BuiltSegment[];
  endHour: number;
};

// Builds one logical session: a start, then any number of pause and resume
// segments. Every segment but the last is PAUSED, because pausing closes a
// segment and resuming inserts a new row rather than reopening the old one.
// The last segment is STOPPED for a finished session, or PAUSED for one that
// was paused and never picked back up.
function buildSession(
  rand: Rand,
  day: Date,
  startHour: number,
  options: { notesPool: readonly (string | null)[]; shortSession?: boolean },
): BuiltSession | null {
  if (startHour >= LATEST_END_HOUR - 1) return null;

  const segmentCount = options.shortSession
    ? rand.chance(0.2)
      ? 2
      : 1
    : rand.int(1, 3);

  const segments: BuiltSegment[] = [];
  // The first segment's id doubles as the session id for every segment.
  const firstId = rand.uuid();
  let cursor = atUtcTime(day, startHour, rand.pick([0, 15, 30, 45]));

  for (let i = 0; i < segmentCount; i++) {
    const isLast = i === segmentCount - 1;
    const maxMinutes = options.shortSession ? 90 : 200;
    let durationMinutes = rand.int(options.shortSession ? 15 : 25, maxMinutes);

    // Never let a segment run past the cap or past the end of its own day.
    const endOfWindow = atUtcTime(day, LATEST_END_HOUR, 0);
    const remainingToday = Math.floor(
      (endOfWindow.getTime() - cursor.getTime()) / 60000,
    );
    if (remainingToday < 15) break;
    durationMinutes = Math.min(
      durationMinutes,
      remainingToday,
      MAX_CONTINUOUS_SESSION_MINUTES,
    );

    const startedAt = cursor;
    const endedAt = addMinutes(startedAt, durationMinutes);

    segments.push({
      id: i === 0 ? firstId : rand.uuid(),
      // A paused or stopped segment always has both an end and a duration.
      status: isLast
        ? rand.chance(0.12)
          ? TimeEntryStatus.PAUSED
          : TimeEntryStatus.STOPPED
        : TimeEntryStatus.PAUSED,
      notes: rand.pick(options.notesPool) ?? null,
      startedAt,
      endedAt,
      durationMinutes,
    });

    // The gap is the break between pausing and resuming. It also keeps
    // startedAt strictly increasing across the session.
    cursor = addMinutes(endedAt, rand.int(5, 45));
  }

  if (segments.length === 0) return null;

  const last = segments[segments.length - 1];
  return {
    sessionId: firstId,
    segments,
    endHour: (last.endedAt ?? last.startedAt).getUTCHours(),
  };
}

// Picks users for the live timers, making sure nobody ends up with a running
// project timer and a running meeting timer at the same time.
function pickLiveTimerUsers(
  rand: Rand,
  workerIds: string[],
  meetingAttendees: string[],
) {
  const projectTimers = rand.sample(workerIds, VOLUME.runningTimeEntries);
  const taken = new Set(projectTimers);
  const meetingTimers = rand
    .shuffle(meetingAttendees)
    .filter((id) => !taken.has(id))
    .slice(0, VOLUME.runningMeetingEntries);
  return { projectTimers, meetingTimers };
}

// A start time a short while ago on the current real UTC day. Staying inside
// today and inside the nine hour cap means the app will not immediately auto
// stop these on the next write.
function liveTimerStart(rand: Rand): Date {
  const now = new Date();
  const minutesSinceUtcMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
  const minutesAgo = Math.min(
    rand.int(20, 180),
    Math.max(minutesSinceUtcMidnight - 5, 5),
  );
  return addMinutes(now, -minutesAgo);
}
