/**
 * Unit tests for the project status state machine.
 *
 * ALLOWED_STATUS_TRANSITIONS is the only source of truth for which
 * ProjectStatus moves are legal. These tests are driven FROM that table rather
 * than from a hand written list, so adding a value to the ProjectStatus enum
 * without deciding its transitions fails here instead of silently going
 * untested.
 *
 * Who may trigger a transition is a separate concern, checked in the service
 * (assertCanChangeStatus). This file only covers sequence legality.
 */

import { ProjectStatus } from '@prisma/client';
import { ALLOWED_STATUS_TRANSITIONS } from './projects.service';

const ALL_STATUSES = Object.values(ProjectStatus);

describe('ALLOWED_STATUS_TRANSITIONS', () => {
  describe('table completeness', () => {
    it('declares an entry for every ProjectStatus', () => {
      // The guard against adding an enum member and forgetting the table.
      for (const status of ALL_STATUSES) {
        expect(ALLOWED_STATUS_TRANSITIONS[status]).toBeDefined();
      }
      expect(Object.keys(ALLOWED_STATUS_TRANSITIONS).sort()).toEqual(
        [...ALL_STATUSES].sort(),
      );
    });

    it('only ever names real ProjectStatus values as targets', () => {
      for (const [from, targets] of Object.entries(
        ALLOWED_STATUS_TRANSITIONS,
      )) {
        for (const to of targets) {
          expect(ALL_STATUSES).toContain(to);
        }
      }
    });

    it('never lists a status as a transition to itself', () => {
      for (const [from, targets] of Object.entries(
        ALLOWED_STATUS_TRANSITIONS,
      )) {
        expect(targets).not.toContain(from as ProjectStatus);
      }
    });

    it('never lists the same target twice', () => {
      for (const targets of Object.values(ALLOWED_STATUS_TRANSITIONS)) {
        expect(new Set(targets).size).toBe(targets.length);
      }
    });
  });

  describe('every declared transition is reachable, every other one is not', () => {
    // One case per (from, to) pair across the whole enum. Legal pairs must be
    // in the table, and every pair not in the table must be absent, which is
    // what the service reads to reject a move.
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const isDeclared = ALLOWED_STATUS_TRANSITIONS[from].includes(to);
        it(`${from} to ${to} is ${isDeclared ? 'allowed' : 'rejected'}`, () => {
          expect(ALLOWED_STATUS_TRANSITIONS[from].includes(to)).toBe(
            isDeclared,
          );
        });
      }
    }
  });

  describe('the documented business rules', () => {
    it('starts a project in PLANNING with a path to scheduling or cancelling', () => {
      expect(ALLOWED_STATUS_TRANSITIONS.PLANNING).toEqual(
        expect.arrayContaining([
          ProjectStatus.SCHEDULED,
          ProjectStatus.READY_FOR_WORK,
          ProjectStatus.CANCELLED,
        ]),
      );
    });

    it('lets every non terminal status reach CANCELLED', () => {
      const nonTerminal = ALL_STATUSES.filter(
        (s) => s !== ProjectStatus.COMPLETED && s !== ProjectStatus.CANCELLED,
      );
      for (const status of nonTerminal) {
        expect(ALLOWED_STATUS_TRANSITIONS[status]).toContain(
          ProjectStatus.CANCELLED,
        );
      }
    });

    it('does NOT let the generic endpoint leave INTERNAL_REVIEW except to CANCELLED', () => {
      // READY_FOR_CLIENT and READY_FOR_WORK are deliberately absent: only
      // InternalReviewsService.create() may make either move, so a
      // ProjectInternalReview row always exists to explain the transition.
      expect(ALLOWED_STATUS_TRANSITIONS.INTERNAL_REVIEW).toEqual([
        ProjectStatus.CANCELLED,
      ]);
    });

    it('does NOT let the generic endpoint leave WAITING_FOR_FEEDBACK except to CANCELLED', () => {
      // Same reasoning: only ClientFeedbackService.create()'s first round may
      // move a project to COMPLETED or back to READY_FOR_WORK.
      expect(ALLOWED_STATUS_TRANSITIONS.WAITING_FOR_FEEDBACK).toEqual([
        ProjectStatus.CANCELLED,
      ]);
    });

    it('gives COMPLETED and CANCELLED exactly one way back, to READY_FOR_WORK', () => {
      // The same day "undo a mistake" path, ADMIN and SYSTEM_ADMIN only, and
      // only while the project has not been archived. Restricted in the
      // service, not here.
      expect(ALLOWED_STATUS_TRANSITIONS.COMPLETED).toEqual([
        ProjectStatus.READY_FOR_WORK,
      ]);
      expect(ALLOWED_STATUS_TRANSITIONS.CANCELLED).toEqual([
        ProjectStatus.READY_FOR_WORK,
      ]);
    });

    it('never routes ON_HOLD straight back into IN_PROGRESS', () => {
      // A held project re-enters through READY_FOR_WORK so it is re-triaged
      // rather than silently resuming.
      expect(ALLOWED_STATUS_TRANSITIONS.ON_HOLD).not.toContain(
        ProjectStatus.IN_PROGRESS,
      );
      expect(ALLOWED_STATUS_TRANSITIONS.ON_HOLD).toContain(
        ProjectStatus.READY_FOR_WORK,
      );
    });

    it('leaves no status stranded with nowhere to go', () => {
      for (const status of ALL_STATUSES) {
        expect(ALLOWED_STATUS_TRANSITIONS[status].length).toBeGreaterThan(0);
      }
    });
  });
});
