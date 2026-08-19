/**
 * Unit tests for the dashboard ordering used by GET /projects/mine and
 * GET /projects/users/:userId.
 *
 * The order is applied in JS rather than as a Prisma orderBy, because the
 * active status bucket is computed rather than stored. That makes it exactly
 * the kind of logic that drifts silently, so it is pinned here.
 *
 * Documented order, all ascending (most urgent or soonest first):
 *   active status, then Priority, then Deadline, then Planned Start Date.
 */

import { ProjectPriority, ProjectStatus } from '@prisma/client';
import {
  compareForDashboard,
  compareNullableDates,
  DASHBOARD_ACTIVE_STATUSES,
  PRIORITY_RANK,
} from '../projects.service';

/** Minimal shape compareForDashboard actually reads. */
function project(overrides: {
  status?: ProjectStatus;
  priority?: ProjectPriority;
  deadline?: Date | null;
  plannedStartDate?: Date | null;
  name?: string;
}) {
  return {
    status: overrides.status ?? ProjectStatus.PLANNING,
    priority: overrides.priority ?? ProjectPriority.MEDIUM,
    deadline: overrides.deadline ?? null,
    plannedStartDate: overrides.plannedStartDate ?? null,
    name: overrides.name ?? 'project',
  } as unknown as Parameters<typeof compareForDashboard>[0];
}

const d = (iso: string) => new Date(iso);

describe('compareNullableDates', () => {
  it('orders two real dates ascending', () => {
    expect(compareNullableDates(d('2026-01-01'), d('2026-02-01'))).toBeLessThan(
      0,
    );
    expect(
      compareNullableDates(d('2026-02-01'), d('2026-01-01')),
    ).toBeGreaterThan(0);
  });

  it('treats two equal dates as equal', () => {
    expect(compareNullableDates(d('2026-01-01'), d('2026-01-01'))).toBe(0);
  });

  it('sorts a null date LAST, not first', () => {
    // A project with no deadline is not urgent. Getting this backwards would
    // push undated work to the top of every dashboard.
    expect(compareNullableDates(null, d('2026-01-01'))).toBeGreaterThan(0);
    expect(compareNullableDates(d('2026-01-01'), null)).toBeLessThan(0);
  });

  it('treats two nulls as equal', () => {
    expect(compareNullableDates(null, null)).toBe(0);
  });
});

describe('PRIORITY_RANK', () => {
  it('ranks every ProjectPriority', () => {
    for (const priority of Object.values(ProjectPriority)) {
      expect(PRIORITY_RANK[priority]).toBeDefined();
    }
  });

  it('ranks CRITICAL most urgent and LOW least urgent', () => {
    expect(PRIORITY_RANK.CRITICAL).toBeLessThan(PRIORITY_RANK.URGENT);
    expect(PRIORITY_RANK.URGENT).toBeLessThan(PRIORITY_RANK.HIGH);
    expect(PRIORITY_RANK.HIGH).toBeLessThan(PRIORITY_RANK.MEDIUM);
    expect(PRIORITY_RANK.MEDIUM).toBeLessThan(PRIORITY_RANK.LOW);
  });
});

describe('compareForDashboard', () => {
  describe('first key: active status', () => {
    it.each(DASHBOARD_ACTIVE_STATUSES)(
      'sorts %s ahead of a non active status',
      (activeStatus) => {
        const active = project({ status: activeStatus });
        const inactive = project({ status: ProjectStatus.PLANNING });
        expect(compareForDashboard(active, inactive)).toBeLessThan(0);
        expect(compareForDashboard(inactive, active)).toBeGreaterThan(0);
      },
    );

    it('beats priority: an active LOW sorts ahead of an inactive CRITICAL', () => {
      // Status is the FIRST key, so this ordering is deliberate. A critical
      // project still in PLANNING is not something to work on today.
      const activeLow = project({
        status: ProjectStatus.IN_PROGRESS,
        priority: ProjectPriority.LOW,
      });
      const inactiveCritical = project({
        status: ProjectStatus.PLANNING,
        priority: ProjectPriority.CRITICAL,
      });
      expect(compareForDashboard(activeLow, inactiveCritical)).toBeLessThan(0);
    });
  });

  describe('second key: priority', () => {
    it('sorts CRITICAL ahead of LOW within the same status', () => {
      const critical = project({
        status: ProjectStatus.IN_PROGRESS,
        priority: ProjectPriority.CRITICAL,
      });
      const low = project({
        status: ProjectStatus.IN_PROGRESS,
        priority: ProjectPriority.LOW,
      });
      expect(compareForDashboard(critical, low)).toBeLessThan(0);
    });

    it('beats deadline: a CRITICAL due later sorts ahead of a LOW due sooner', () => {
      const criticalLate = project({
        priority: ProjectPriority.CRITICAL,
        deadline: d('2026-12-01'),
      });
      const lowSoon = project({
        priority: ProjectPriority.LOW,
        deadline: d('2026-01-01'),
      });
      expect(compareForDashboard(criticalLate, lowSoon)).toBeLessThan(0);
    });
  });

  describe('third key: deadline', () => {
    it('sorts the sooner deadline first at equal status and priority', () => {
      const soon = project({ deadline: d('2026-01-01') });
      const later = project({ deadline: d('2026-06-01') });
      expect(compareForDashboard(soon, later)).toBeLessThan(0);
    });

    it('sorts a project with no deadline after one that has a deadline', () => {
      const dated = project({ deadline: d('2026-06-01') });
      const undated = project({ deadline: null });
      expect(compareForDashboard(dated, undated)).toBeLessThan(0);
    });
  });

  describe('fourth key: planned start date', () => {
    it('breaks a full tie on planned start, soonest first', () => {
      const startsSoon = project({
        deadline: d('2026-06-01'),
        plannedStartDate: d('2026-01-01'),
      });
      const startsLater = project({
        deadline: d('2026-06-01'),
        plannedStartDate: d('2026-03-01'),
      });
      expect(compareForDashboard(startsSoon, startsLater)).toBeLessThan(0);
    });

    it('sorts a project with no planned start last', () => {
      const dated = project({ plannedStartDate: d('2026-01-01') });
      const undated = project({ plannedStartDate: null });
      expect(compareForDashboard(dated, undated)).toBeLessThan(0);
    });

    it('returns 0 when every key ties', () => {
      const a = project({
        deadline: d('2026-06-01'),
        plannedStartDate: d('2026-01-01'),
      });
      const b = project({
        deadline: d('2026-06-01'),
        plannedStartDate: d('2026-01-01'),
      });
      expect(compareForDashboard(a, b)).toBe(0);
    });
  });

  describe('as an actual sort', () => {
    it('produces the documented order end to end', () => {
      const list = [
        project({
          name: 'planning-critical',
          status: ProjectStatus.PLANNING,
          priority: ProjectPriority.CRITICAL,
        }),
        project({
          name: 'inprogress-low-no-deadline',
          status: ProjectStatus.IN_PROGRESS,
          priority: ProjectPriority.LOW,
        }),
        project({
          name: 'ready-critical',
          status: ProjectStatus.READY_FOR_WORK,
          priority: ProjectPriority.CRITICAL,
          deadline: d('2026-05-01'),
        }),
        project({
          name: 'inprogress-critical-sooner',
          status: ProjectStatus.IN_PROGRESS,
          priority: ProjectPriority.CRITICAL,
          deadline: d('2026-01-01'),
        }),
        project({
          name: 'onhold-urgent',
          status: ProjectStatus.ON_HOLD,
          priority: ProjectPriority.URGENT,
        }),
      ];

      const sorted = [...list]
        .sort(compareForDashboard)
        .map((p) => (p as { name: string }).name);

      expect(sorted).toEqual([
        // active statuses first, ordered by priority then deadline
        'inprogress-critical-sooner',
        'ready-critical',
        'inprogress-low-no-deadline',
        // then everything else, by priority
        'planning-critical',
        'onhold-urgent',
      ]);
    });

    it('is a stable, self consistent comparator', () => {
      // A comparator that contradicts itself produces a different result
      // depending on input order, which is how a sort silently goes wrong.
      const items = [
        project({
          status: ProjectStatus.IN_PROGRESS,
          priority: ProjectPriority.HIGH,
          deadline: d('2026-03-01'),
        }),
        project({
          status: ProjectStatus.PLANNING,
          priority: ProjectPriority.CRITICAL,
        }),
        project({
          status: ProjectStatus.READY_FOR_WORK,
          priority: ProjectPriority.LOW,
          deadline: null,
        }),
        project({
          status: ProjectStatus.COMPLETED,
          priority: ProjectPriority.MEDIUM,
          deadline: d('2026-02-01'),
        }),
      ];
      // `+ 0` normalises -0 to 0: Math.sign(0) negated is -0, and Jest's toBe
      // uses Object.is, where -0 and 0 are not the same value.
      for (const a of items) {
        for (const b of items) {
          expect(Math.sign(compareForDashboard(a, b)) + 0).toBe(
            -Math.sign(compareForDashboard(b, a)) + 0,
          );
        }
      }
    });
  });
});
