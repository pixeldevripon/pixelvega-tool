import { ProjectStatus } from '@prisma/client';

import {
  buildStatusClause,
  PROJECT_PHASES,
  PROJECT_PHASE_DISPLAY,
  PROJECT_PHASE_STATUSES,
  projectPhaseOf,
  type ProjectPhase,
} from '@/projects/project-phase';

/**
 * The phase grouping is a lookup table, and the only way a lookup table breaks
 * is by being incomplete. These are the cases that would catch that, and
 * nothing else: asserting that `PLANNING` reads "To do" would be asserting the
 * table against itself.
 */
describe('project phase', () => {
  it('places every ProjectStatus in exactly one phase', () => {
    // The whole point: driven off the enum, so a status added to the schema and
    // forgotten in the grouping fails here rather than returning `undefined`
    // from `projectPhaseOf` and putting a project in no column at all.
    for (const status of Object.values(ProjectStatus)) {
      const phases = PROJECT_PHASES.filter((phase) =>
        PROJECT_PHASE_STATUSES[phase].includes(status),
      );

      expect(phases).toHaveLength(1);
    }
  });

  it('claims no status the schema does not have', () => {
    const placed = PROJECT_PHASES.flatMap(
      (phase) => PROJECT_PHASE_STATUSES[phase],
    );
    const known = Object.values(ProjectStatus);

    for (const status of placed) {
      expect(known).toContain(status);
    }
  });

  it('resolves a status to the phase it is listed under', () => {
    for (const phase of PROJECT_PHASES) {
      for (const status of PROJECT_PHASE_STATUSES[phase]) {
        expect(projectPhaseOf(status)).toBe(phase);
      }
    }
  });

  it('gives every phase a label and a tone', () => {
    for (const phase of PROJECT_PHASES) {
      expect(PROJECT_PHASE_DISPLAY[phase].label).toBeTruthy();
      expect(PROJECT_PHASE_DISPLAY[phase].tone).toBeTruthy();
    }
  });

  /**
   * The two placements the file argues about, pinned so a later tidy-up cannot
   * quietly move them. A paused project has started, and a cancelled one is
   * finished; both are the more expensive error in the other direction.
   */
  it('keeps ON_HOLD in progress and CANCELLED closed', () => {
    expect(projectPhaseOf(ProjectStatus.ON_HOLD)).toBe<ProjectPhase>(
      'IN_PROGRESS',
    );
    expect(projectPhaseOf(ProjectStatus.CANCELLED)).toBe<ProjectPhase>(
      'CLOSED',
    );
  });

  it('orders the phases as work flows through them', () => {
    // The board renders `PROJECT_PHASES` in array order, so the order IS the
    // contract: a reader scanning left to right is reading a lifecycle.
    expect([...PROJECT_PHASES]).toEqual([
      'TO_DO',
      'IN_PROGRESS',
      'IN_REVIEW',
      'CLOSED',
    ]);
  });

  /**
   * The clause, asserted as a VALUE rather than through a Prisma mock. What
   * matters is the `where` fragment itself: a spec that only proved
   * `findMany` was called would pass with every one of these four branches
   * returning the wrong set.
   */
  describe('buildStatusClause', () => {
    it('filters on nothing when neither is given', () => {
      expect(buildStatusClause(undefined, undefined)).toEqual({});
    });

    it('filters on one status when only a status is given', () => {
      expect(buildStatusClause(ProjectStatus.ON_HOLD, undefined)).toEqual({
        status: { in: [ProjectStatus.ON_HOLD] },
      });
    });

    it('filters on every status in the phase when only a phase is given', () => {
      expect(buildStatusClause(undefined, 'IN_REVIEW')).toEqual({
        status: {
          in: [
            ProjectStatus.INTERNAL_REVIEW,
            ProjectStatus.READY_FOR_CLIENT,
            ProjectStatus.WAITING_FOR_FEEDBACK,
          ],
        },
      });
    });

    it('intersects to the one status when both agree', () => {
      expect(
        buildStatusClause(ProjectStatus.WAITING_FOR_FEEDBACK, 'IN_REVIEW'),
      ).toEqual({ status: { in: [ProjectStatus.WAITING_FOR_FEEDBACK] } });
    });

    it('matches nothing when the status sits outside the phase', () => {
      // The case a pair of independent spreads gets wrong: one key would
      // overwrite the other and the surviving filter would quietly widen the
      // result to a whole lane, or to every planning project.
      expect(buildStatusClause(ProjectStatus.PLANNING, 'IN_REVIEW')).toEqual({
        status: { in: [] },
      });
    });
  });
});
