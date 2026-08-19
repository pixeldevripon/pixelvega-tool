import { BlockerStatus, Prisma } from '@prisma/client';

import { formatDuration } from '@/common/utils/duration.util';
import {
  BLOCKER_SEVERITY_DISPLAY,
  BLOCKER_STATUS_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';
import { BlockerCapabilitiesDto, BlockerResponseDto } from './dto/blocker.dto';

const MINUTES_PER_DAY = 60 * 24;

export const BLOCKER_INCLUDE = {
  project: { select: { id: true, name: true, slackChannelId: true } },
  reason: {
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  },
  reportedBy: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  resolvedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.BlockerInclude;

export type BlockerWithRelations = Prisma.BlockerGetPayload<{
  include: typeof BLOCKER_INCLUDE;
}>;

export type BlockerContext = {
  /** Does the caller manage this project? From `ProjectScopeService`. */
  managesProject: boolean;
  /** Is the caller staffed on this project, whatever their role? */
  isProjectMember: boolean;
};

/**
 * How long a blocker has been in the way.
 *
 * Measured to resolution when resolved, and to now when not, so a dashboard can
 * sort by it without special casing the open ones. `now` is a parameter so the
 * arithmetic is testable rather than dependent on when the suite runs.
 */
function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

export function toBlockerResponse(
  blocker: BlockerWithRelations,
  context: BlockerContext,
  now: Date = new Date(),
): BlockerResponseDto {
  const isResolved = blocker.status === BlockerStatus.RESOLVED;
  const resolutionMinutes =
    isResolved && blocker.resolvedAt
      ? minutesBetween(blocker.createdAt, blocker.resolvedAt)
      : null;
  const ageMinutes =
    resolutionMinutes ?? minutesBetween(blocker.createdAt, now);

  return {
    id: blocker.id,
    projectId: blocker.projectId,
    project: { id: blocker.project.id, name: blocker.project.name },
    description: blocker.description,
    status: toEnumDisplay(BLOCKER_STATUS_DISPLAY, blocker.status),
    severity: toEnumDisplay(BLOCKER_SEVERITY_DISPLAY, blocker.severity),
    reason: blocker.reason,
    reportedBy: blocker.reportedBy,
    assignedTo: blocker.assignedTo,
    assignedAt: blocker.assignedAt,
    resolvedBy: blocker.resolvedBy,
    resolvedAt: blocker.resolvedAt,
    resolutionNotes: blocker.resolutionNotes,
    deadlineExtensionDays: blocker.deadlineExtensionDays,
    isResolved,
    resolutionMinutes,
    resolutionLabel: formatDuration(resolutionMinutes),
    ageMinutes,
    ageLabel: formatDuration(ageMinutes) as string,
    // Null rather than undefined, so the field is always present in the JSON
    // and a client never has to distinguish "absent" from "zero days".
    daysOpen: isResolved ? null : Math.floor(ageMinutes / MINUTES_PER_DAY),
    causedDeadlineExtension: (blocker.deadlineExtensionDays ?? 0) > 0,
    createdAt: blocker.createdAt,
    updatedAt: blocker.updatedAt,
    capabilities: capabilitiesFor(blocker, context),
  };
}

/**
 * Everything hangs off one rule: a RESOLVED blocker is locked, permanently.
 *
 * The service rejects any edit to a resolved blocker outright, so reporting
 * anything as still possible would be offering a button that 409s.
 */
function capabilitiesFor(
  blocker: { status: BlockerStatus },
  context: BlockerContext,
): BlockerCapabilitiesDto {
  const isLocked = blocker.status === BlockerStatus.RESOLVED;
  const canAct =
    !isLocked && (context.managesProject || context.isProjectMember);

  return {
    canEdit: canAct,
    // Status is forward only, and RESOLVED is the end of the line.
    canChangeStatus: canAct,
    canResolve: canAct,
    canReassign: canAct,
  };
}
