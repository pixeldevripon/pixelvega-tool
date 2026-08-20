import { ProjectStatus } from '@prisma/client';

import type { EnumDisplayEntry } from '@/common/utils/enum-display.util';

/**
 * The four lanes a project board reads in.
 *
 * ── Why a phase exists at all, when there is already a status ──
 *
 * There are ten `ProjectStatus` members, which is the right number for a badge
 * and the wrong number for a board: ten columns is a horizontal scroll nobody
 * reads to the end of, and six of them are the same answer to "has this
 * started" phrased differently. A phase is the coarse question a board answers:
 * has the work begun, is it moving, is someone judging it, is it finished.
 *
 * This is a grouping of the business's own vocabulary, so it lives here and
 * ships as a field. A browser deciding that `WAITING_FOR_FEEDBACK` belongs under
 * "In review" is a second copy of a business rule, and the second copy is the
 * one that goes stale (D4).
 *
 * Not a Prisma enum, deliberately. Nothing is STORED in a phase: it is read off
 * the status every time, so adding a column for it would create two sources for
 * one fact and a migration whenever the grouping is reconsidered.
 */
export const PROJECT_PHASES = [
  'TO_DO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'CLOSED',
] as const;

export type ProjectPhase = (typeof PROJECT_PHASES)[number];

/**
 * Which statuses each phase covers.
 *
 * ── The two placements worth arguing about ──
 *
 * `ON_HOLD` is **In progress**, not To do. A paused project has started; filing
 * it under "To do" would claim the work has not begun, which is false and is the
 * more expensive of the two errors: it hides work in flight from whoever is
 * deciding what to staff next. Its status badge stays amber on the card, so the
 * card still says "On hold" in words.
 *
 * `CANCELLED` is **Closed**, alongside `COMPLETED`, which is why the phase is
 * called Closed rather than Completed. The two are not the same outcome and the
 * card's own status badge is what distinguishes them; what they share is that
 * there is no work left to do, which is the only question a board column asks.
 *
 * `spec/project-phase.spec.ts` is what keeps this honest. It walks
 * `Object.values(ProjectStatus)` and asserts each member appears in exactly one
 * phase, so a status added to the schema and forgotten here, or pasted into two
 * lanes, fails the gate. That check cannot be a type: the record is built by
 * `Object.fromEntries` below, which erases the literal types a compile-time
 * exhaustiveness check would need.
 */
export const PROJECT_PHASE_STATUSES: Record<ProjectPhase, ProjectStatus[]> = {
  TO_DO: [
    ProjectStatus.PLANNING,
    ProjectStatus.SCHEDULED,
    ProjectStatus.READY_FOR_WORK,
  ],
  IN_PROGRESS: [ProjectStatus.IN_PROGRESS, ProjectStatus.ON_HOLD],
  IN_REVIEW: [
    ProjectStatus.INTERNAL_REVIEW,
    ProjectStatus.READY_FOR_CLIENT,
    ProjectStatus.WAITING_FOR_FEEDBACK,
  ],
  CLOSED: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
};

/**
 * How a phase reads, and at what tone.
 *
 * The tone is a judgment about the business, not styling. `IN_REVIEW` is
 * `warning` because a project sitting in review is waiting on a person, which is
 * the state most worth chasing; it is not `danger`, because waiting for a review
 * is the process working rather than something going wrong.
 */
export const PROJECT_PHASE_DISPLAY: Record<ProjectPhase, EnumDisplayEntry> = {
  TO_DO: { label: 'To do', tone: 'default' },
  IN_PROGRESS: { label: 'In progress', tone: 'primary' },
  IN_REVIEW: { label: 'In review', tone: 'warning' },
  CLOSED: { label: 'Closed', tone: 'success' },
};

/**
 * Built from the map above rather than written out a second time, so a status
 * that moves between phases moves in exactly one place.
 */
const PHASE_BY_STATUS: Record<ProjectStatus, ProjectPhase> = Object.fromEntries(
  PROJECT_PHASES.flatMap((phase) =>
    PROJECT_PHASE_STATUSES[phase].map((status) => [status, phase]),
  ),
) as Record<ProjectStatus, ProjectPhase>;

/**
 * The phase a status sits in.
 *
 * Total because the spec proves every status is placed, NOT because the cast
 * above says so: `Object.fromEntries` returns an index signature, and asserting
 * it into a full record is what makes the lookup typecheck. An unplaced status
 * would therefore return `undefined` at runtime while still satisfying the
 * compiler, which is exactly the hole `spec/project-phase.spec.ts` closes.
 */
export function projectPhaseOf(status: ProjectStatus): ProjectPhase {
  return PHASE_BY_STATUS[status];
}

/**
 * The `status` clause for a project query, from a status, a phase, or both.
 *
 * One helper rather than two spreads at the call site, because "both" is the
 * case a pair of independent spreads gets wrong: the second `status` key would
 * silently overwrite the first, so whichever spread came last would win and the
 * other filter would vanish without an error.
 *
 * Both together INTERSECT. `?phase=IN_REVIEW&status=PLANNING` is a request for
 * projects that are both, which is nothing, and an empty `in` is how Prisma
 * spells "nothing matches". Answering it with the whole review lane, or with
 * every planning project, would be honouring a filter the caller did not send.
 */
export function buildStatusClause(
  status: ProjectStatus | undefined,
  phase: ProjectPhase | undefined,
): { status?: { in: ProjectStatus[] } } {
  if (!status && !phase) return {};

  const inPhase = phase ? PROJECT_PHASE_STATUSES[phase] : null;

  if (!inPhase) return { status: { in: [status as ProjectStatus] } };
  if (!status) return { status: { in: inPhase } };

  return { status: { in: inPhase.filter((member) => member === status) } };
}
