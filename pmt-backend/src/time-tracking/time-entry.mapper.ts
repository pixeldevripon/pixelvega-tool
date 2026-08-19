import {
  MeetingTimeEntry,
  Project,
  TimeEntry,
  TimeEntryStatus,
  User,
} from '@prisma/client';

import { formatDuration, toHours } from '@/common/utils/duration.util';
import {
  TIME_ENTRY_STATUS_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';
import {
  DailyTimeTotalDto,
  MeetingTimeEntryResponseDto,
  ProjectTimeTotalDto,
  TimeEntryCapabilitiesDto,
  TimeEntryResponseDto,
} from './dto/time-entry.dto';

type EntryUser = Pick<User, 'id' | 'name' | 'email'>;

export type TimeEntryWithRelations = TimeEntry & {
  user?: EntryUser;
  project?: Pick<Project, 'id' | 'name'>;
};

export type MeetingTimeEntryWithRelations = MeetingTimeEntry & {
  user?: EntryUser;
};

/**
 * Who is asking.
 *
 * Only the owner may pause, resume or stop a segment, and that rule survives
 * admin on purpose: a timer belongs to the person running it. So the only thing
 * the capabilities need is the caller's id.
 */
export type TimeEntryContext = {
  callerId: string;
};

/**
 * The three controls, from the segment's status and who owns it.
 *
 * Derived here rather than in each service so the answer cannot differ between
 * the list endpoint and the detail endpoint, which is exactly the sort of
 * disagreement a client then has to paper over.
 */
function capabilitiesFor(
  entry: { userId: string; status: TimeEntryStatus },
  context: TimeEntryContext,
): TimeEntryCapabilitiesDto {
  const isOwner = entry.userId === context.callerId;
  return {
    canPause: isOwner && entry.status === TimeEntryStatus.RUNNING,
    canResume: isOwner && entry.status === TimeEntryStatus.PAUSED,
    // A stopped segment is final. Stopping it again is the 409 this prevents.
    canStop: isOwner && entry.status !== TimeEntryStatus.STOPPED,
  };
}

export function toTimeEntryResponse(
  entry: TimeEntryWithRelations,
  context: TimeEntryContext,
): TimeEntryResponseDto {
  return {
    id: entry.id,
    projectId: entry.projectId,
    userId: entry.userId,
    sessionId: entry.sessionId,
    status: toEnumDisplay(TIME_ENTRY_STATUS_DISPLAY, entry.status),
    notes: entry.notes,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    durationMinutes: entry.durationMinutes,
    durationLabel: formatDuration(entry.durationMinutes),
    ...(entry.user && { user: entry.user }),
    ...(entry.project && { project: entry.project }),
    capabilities: capabilitiesFor(entry, context),
  };
}

export function toMeetingTimeEntryResponse(
  entry: MeetingTimeEntryWithRelations,
  context: TimeEntryContext,
): MeetingTimeEntryResponseDto {
  return {
    id: entry.id,
    userId: entry.userId,
    sessionId: entry.sessionId,
    status: toEnumDisplay(TIME_ENTRY_STATUS_DISPLAY, entry.status),
    notes: entry.notes,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    durationMinutes: entry.durationMinutes,
    durationLabel: formatDuration(entry.durationMinutes),
    ...(entry.user && { user: entry.user }),
    capabilities: capabilitiesFor(entry, context),
  };
}

/**
 * The three ways a total is expressed, built once from the exact minutes.
 *
 * Every totals bearing response uses this, so `totalHours` and `totalLabel` can
 * never be rounded two different ways in two endpoints (ADR 0003).
 */
export function toTotals(totalMinutes: number) {
  return {
    totalMinutes,
    totalHours: toHours(totalMinutes),
    totalLabel: formatDuration(totalMinutes) as string,
  };
}

export function toProjectTimeTotal(row: {
  projectId: string;
  projectName: string | null;
  totalMinutes: number;
}): ProjectTimeTotalDto {
  return {
    projectId: row.projectId,
    projectName: row.projectName,
    ...toTotals(row.totalMinutes),
  };
}

export function toDailyTimeTotal(row: {
  date: string;
  totalMinutes: number;
}): DailyTimeTotalDto {
  return { date: row.date, ...toTotals(row.totalMinutes) };
}
