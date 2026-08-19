import type { PrismaClient } from '@prisma/client';
import {
  AdditionalRequirementStatus,
  BlockerSeverity,
  BlockerStatus,
  ClientFeedbackDecision,
  InternalReviewDecision,
  ProjectStatus,
} from '@prisma/client';
import { SEED_TODAY, VOLUME } from './config';
import { Rand, addDays, addMinutes } from './random';
import {
  ADDITIONAL_REQUIREMENT_DESCRIPTIONS,
  BLOCKER_DESCRIPTIONS,
  BLOCKER_RESOLUTIONS,
  CLIENT_FEEDBACK_COMMENTS,
  INTERNAL_REVIEW_COMMENTS,
  SOURCE_CHANNELS,
} from './pools';
import type { SeededProject } from './projects';
import type { SeededReference } from './reference';
import type { SeededUsers } from './users';

export type SeededWorkflow = {
  additionalRequirementCount: number;
  blockerCount: number;
  internalReviewCount: number;
  clientFeedbackCount: number;
  /**
   * Extra days that resolved blockers and approved requirements added on top
   * of each project's original deadline. The caller applies these, so the
   * stored deadline already includes them, the same way the app does it.
   */
  deadlineExtensions: Map<string, number>;
  /** Extra hours approved requirements added on top of estimatedHours. */
  hourAdditions: Map<string, number>;
};

// Statuses only reachable by passing internal QA, so their newest review round
// must be the approving one.
const PAST_INTERNAL_REVIEW: ProjectStatus[] = [
  ProjectStatus.READY_FOR_CLIENT,
  ProjectStatus.WAITING_FOR_FEEDBACK,
  ProjectStatus.COMPLETED,
];

export async function seedWorkflow(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
  reference: SeededReference,
): Promise<SeededWorkflow> {
  const deadlineExtensions = new Map<string, number>();
  const hourAdditions = new Map<string, number>();

  function addExtension(projectId: string, days: number) {
    if (days <= 0) return;
    deadlineExtensions.set(
      projectId,
      (deadlineExtensions.get(projectId) ?? 0) + days,
    );
  }

  const requirementCount = await seedAdditionalRequirements(
    prisma,
    rand,
    users,
    projects,
    { addExtension, hourAdditions },
  );
  const blockerCount = await seedBlockers(
    prisma,
    rand,
    users,
    projects,
    reference,
    {
      addExtension,
    },
  );
  const internalReviewCount = await seedInternalReviews(
    prisma,
    rand,
    users,
    projects,
  );
  const clientFeedbackCount = await seedClientFeedback(
    prisma,
    rand,
    users,
    projects,
  );

  return {
    additionalRequirementCount: requirementCount,
    blockerCount,
    internalReviewCount,
    clientFeedbackCount,
    deadlineExtensions,
    hourAdditions,
  };
}

async function seedAdditionalRequirements(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
  sinks: {
    addExtension: (projectId: string, days: number) => void;
    hourAdditions: Map<string, number>;
  },
) {
  const rows: any[] = [];
  const adminIds = users.adminSide.map((user) => user.id);

  for (const project of projects) {
    // Only a PM staffed on this project, or an admin, can log one.
    const authors =
      project.managerIds.length > 0 ? project.managerIds : adminIds;
    const count = rand.intFrom(VOLUME.additionalRequirementsPerProject);

    for (let i = 0; i < count; i++) {
      const createdAt = rand.dateBetween(
        addDays(project.createdAt, 3),
        project.completedAt ?? SEED_TODAY,
      );

      const roll = rand.float();
      const status =
        roll < 0.3
          ? AdditionalRequirementStatus.PENDING_REVIEW
          : roll < 0.75
            ? AdditionalRequirementStatus.APPROVED
            : AdditionalRequirementStatus.REJECTED;

      const isReviewed = status !== AdditionalRequirementStatus.PENDING_REVIEW;
      const reviewedAt = isReviewed
        ? rand.dateBetween(createdAt, SEED_TODAY)
        : null;

      // Extra hours and deadline days only mean something when approving, and
      // the app rejects them outright on a rejection.
      const isApproved = status === AdditionalRequirementStatus.APPROVED;
      const approvedAdditionalHours =
        isApproved && rand.chance(0.8) ? rand.decimal(2, 40, 1) : null;
      const deadlineExtensionDays =
        isApproved && rand.chance(0.5) ? rand.int(1, 14) : null;

      if (approvedAdditionalHours) {
        sinks.hourAdditions.set(
          project.id,
          (sinks.hourAdditions.get(project.id) ?? 0) + approvedAdditionalHours,
        );
      }
      if (deadlineExtensionDays) {
        sinks.addExtension(project.id, deadlineExtensionDays);
      }

      // The scope checker is advisory and never gates approval. Some rows have
      // never been checked, which is why the column stays nullable.
      const analysis = rand.chance(0.55)
        ? buildScopeAnalysis(rand, createdAt)
        : null;

      rows.push({
        id: rand.uuid(),
        projectId: project.id,
        description: rand.pick(ADDITIONAL_REQUIREMENT_DESCRIPTIONS),
        sourceChannel: rand.maybe(SOURCE_CHANNELS, 0.15) ?? null,
        aiScopeAnalysis: analysis,
        status,
        uploadedById: rand.pick(authors),
        reviewedById: isReviewed ? rand.pick(authors) : null,
        reviewedAt,
        approvedAdditionalHours,
        deadlineExtensionDays,
        createdAt,
        updatedAt: reviewedAt ?? createdAt,
      });
    }
  }

  await prisma.additionalRequirement.createMany({ data: rows });
  return rows.length;
}

// Same shape ScopeCheckService writes: verdict, confidence, reasoning,
// suggestedAdditionalHours, model, and an ISO checkedAt string.
function buildScopeAnalysis(rand: Rand, createdAt: Date) {
  const verdict = rand.pick(['IN_SCOPE', 'OUT_OF_SCOPE', 'UNCLEAR'] as const);
  const reasoning =
    verdict === 'IN_SCOPE'
      ? 'The PRD already covers this under the content and layout requirements, so no extra work is implied.'
      : verdict === 'OUT_OF_SCOPE'
        ? 'Neither the PRD nor the requirement documents mention this, so it adds new work beyond the agreed scope.'
        : 'The requirement documents are ambiguous on this point, so a person should confirm with the client.';

  return {
    verdict,
    confidence: rand.decimal(0.4, 0.98, 2),
    reasoning,
    suggestedAdditionalHours:
      verdict === 'IN_SCOPE' ? 0 : rand.pick([2, 4, 6, 8, 12, 16]),
    model: 'claude-haiku-4-5',
    checkedAt: addMinutes(createdAt, rand.int(2, 600)).toISOString(),
  };
}

async function seedBlockers(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
  reference: SeededReference,
  sinks: { addExtension: (projectId: string, days: number) => void },
) {
  const rows: any[] = [];
  const adminIds = users.adminSide.map((user) => user.id);
  // A soft deleted reason can still be referenced by an existing blocker, but
  // new ones should point at a live reason.
  const liveReasonIds = reference.blockerReasons.map((reason) => reason.id);

  for (const project of projects) {
    // A blocker is reported by someone actively staffed on the project.
    // Nothing to report against on a project with no team yet.
    if (project.memberIds.length === 0) continue;

    const count = rand.intFrom(VOLUME.blockersPerProject);
    for (let i = 0; i < count; i++) {
      const createdAt = rand.dateBetween(
        addDays(project.createdAt, 2),
        project.completedAt ?? SEED_TODAY,
      );

      const roll = rand.float();
      const status =
        roll < 0.22
          ? BlockerStatus.OPEN
          : roll < 0.4
            ? BlockerStatus.IN_PROGRESS
            : BlockerStatus.RESOLVED;

      const reportedById = rand.chance(0.9)
        ? rand.pick(project.memberIds)
        : rand.pick(adminIds);

      // An assignee is always an active member. Moving a blocker to
      // IN_PROGRESS assigns someone, and assignedToId and assignedAt are
      // always written together.
      const needsAssignee =
        status === BlockerStatus.IN_PROGRESS ||
        (status === BlockerStatus.RESOLVED && rand.chance(0.8));
      const assignedToId = needsAssignee ? rand.pick(project.memberIds) : null;
      const assignedAt = assignedToId
        ? rand.dateBetween(createdAt, SEED_TODAY)
        : null;

      // Resolving requires notes, a resolver, and a resolution time. Keeping
      // resolvedAt after createdAt stops the derived resolution time going
      // negative.
      const isResolved = status === BlockerStatus.RESOLVED;
      const resolvedAt = isResolved
        ? addMinutes(createdAt, rand.int(30, 6 * 24 * 60))
        : null;
      const deadlineExtensionDays =
        isResolved && rand.chance(0.3) ? rand.int(1, 10) : null;

      if (deadlineExtensionDays) {
        sinks.addExtension(project.id, deadlineExtensionDays);
      }

      rows.push({
        id: rand.uuid(),
        projectId: project.id,
        description: rand.pick(BLOCKER_DESCRIPTIONS),
        status,
        severity: rand.pick([
          BlockerSeverity.LOW,
          BlockerSeverity.MEDIUM,
          BlockerSeverity.MEDIUM,
          BlockerSeverity.HIGH,
        ]),
        // A blocker reported without an explicit reason falls back to the
        // protected Unspecified row.
        reasonId: rand.chance(0.15)
          ? reference.unspecifiedReasonId
          : rand.pick(liveReasonIds),
        reportedById,
        assignedToId,
        assignedAt,
        resolvedById: isResolved
          ? (assignedToId ?? rand.pick(project.memberIds))
          : null,
        resolvedAt,
        resolutionNotes: isResolved ? rand.pick(BLOCKER_RESOLUTIONS) : null,
        deadlineExtensionDays,
        createdAt,
        updatedAt: resolvedAt ?? assignedAt ?? createdAt,
      });
    }
  }

  await prisma.blocker.createMany({ data: rows });
  return rows.length;
}

async function seedInternalReviews(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
) {
  const rows: any[] = [];
  const adminIds = users.adminSide.map((user) => user.id);

  for (const project of projects) {
    if (!project.hasInternalReview) continue;

    const reviewers =
      project.managerIds.length > 0 ? project.managerIds : adminIds;
    const rounds = rand.intFrom(VOLUME.internalReviewRounds);

    // A project that is past the QA gate got there by being approved, so its
    // newest round is the approval. Anything else was sent back, so every
    // round it has is a changes required round.
    const lastIsApproval = PAST_INTERNAL_REVIEW.includes(project.status);

    let cursor = rand.dateBetween(
      addDays(project.createdAt, 10),
      project.completedAt ?? SEED_TODAY,
    );

    for (let round = 1; round <= rounds; round++) {
      const isLast = round === rounds;
      const decision =
        isLast && lastIsApproval
          ? InternalReviewDecision.APPROVED
          : InternalReviewDecision.CHANGES_REQUIRED;

      // Comments are required when requesting changes, so the developer has
      // something actionable. They are optional on an approval.
      const comments =
        decision === InternalReviewDecision.CHANGES_REQUIRED
          ? rand.pick(INTERNAL_REVIEW_COMMENTS.slice(0, 6))
          : rand.chance(0.6)
            ? rand.pick(INTERNAL_REVIEW_COMMENTS.slice(6))
            : null;

      rows.push({
        id: rand.uuid(),
        projectId: project.id,
        reviewedById: rand.pick(reviewers),
        decision,
        comments,
        reviewRound: round, // rounds always start at 1 and never skip
        createdAt: cursor,
      });

      cursor = addDays(cursor, rand.int(2, 12));
      if (cursor.getTime() > SEED_TODAY.getTime()) cursor = SEED_TODAY;
    }
  }

  await prisma.projectInternalReview.createMany({ data: rows });
  return rows.length;
}

async function seedClientFeedback(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
) {
  const rows: any[] = [];
  const adminIds = users.adminSide.map((user) => user.id);

  for (const project of projects) {
    if (!project.hasClientFeedback) continue;

    const recorders =
      project.managerIds.length > 0 ? project.managerIds : adminIds;
    const rounds = rand.intFrom(VOLUME.clientFeedbackRounds);

    // Only the first round ever moves the project. A COMPLETED project got
    // there because its first round was an approval. Anything else was sent
    // back to the team, so its first round requested changes.
    const firstRoundApproved = project.status === ProjectStatus.COMPLETED;

    let cursor = rand.dateBetween(
      addDays(project.createdAt, 20),
      project.completedAt ?? SEED_TODAY,
    );

    for (let round = 1; round <= rounds; round++) {
      const decision =
        round === 1
          ? firstRoundApproved
            ? ClientFeedbackDecision.APPROVED
            : ClientFeedbackDecision.CHANGES_REQUESTED
          : rand.chance(0.45)
            ? ClientFeedbackDecision.APPROVED
            : ClientFeedbackDecision.CHANGES_REQUESTED;

      // Comments are required exactly when changes are requested.
      const comments =
        decision === ClientFeedbackDecision.CHANGES_REQUESTED
          ? rand.pick(CLIENT_FEEDBACK_COMMENTS.filter((_, i) => i < 4 || i > 5))
          : rand.chance(0.7)
            ? rand.pick(CLIENT_FEEDBACK_COMMENTS.slice(4, 6))
            : null;

      // The client can submit directly, or a PM records feedback the client
      // gave outside the system. recordedById is what tells the two apart.
      const recordedByPm = rand.chance(0.45);

      rows.push({
        id: rand.uuid(),
        projectId: project.id,
        clientId: project.clientId, // always the project's own client
        recordedById: recordedByPm ? rand.pick(recorders) : null,
        decision,
        comments,
        feedbackRound: round,
        createdAt: cursor,
      });

      cursor = addDays(cursor, rand.int(3, 15));
      if (cursor.getTime() > SEED_TODAY.getTime()) cursor = SEED_TODAY;
    }
  }

  await prisma.clientFeedback.createMany({ data: rows });
  return rows.length;
}
