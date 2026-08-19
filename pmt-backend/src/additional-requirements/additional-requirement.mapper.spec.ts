import { AdditionalRequirementStatus } from '@prisma/client';

import {
  AdditionalRequirementWithRelations,
  toAdditionalRequirementResponse,
} from './additional-requirement.mapper';

const AT = new Date('2026-08-12T09:00:00.000Z');
const MANAGER = { managesProject: true };
const READER = { managesProject: false };

function requirement(
  overrides: Partial<AdditionalRequirementWithRelations> = {},
): AdditionalRequirementWithRelations {
  return {
    id: 'r1',
    projectId: 'p1',
    description: 'Client asked for a newsletter form',
    sourceChannel: 'phone call',
    aiScopeAnalysis: null,
    status: AdditionalRequirementStatus.PENDING_REVIEW,
    uploadedById: 'u1',
    reviewedById: null,
    reviewedAt: null,
    approvedAdditionalHours: null,
    deadlineExtensionDays: null,
    createdAt: AT,
    updatedAt: AT,
    uploadedBy: {
      id: 'u1',
      name: 'Rezina Akter',
      email: 'rezina@pixelvega.com',
    },
    reviewedBy: null,
    ...overrides,
  };
}

describe('toAdditionalRequirementResponse', () => {
  it('returns status as a display object', () => {
    expect(
      toAdditionalRequirementResponse(requirement(), MANAGER).status,
    ).toEqual({
      value: 'PENDING_REVIEW',
      label: 'Pending review',
      tone: 'warning',
    });
  });

  describe('isReviewed', () => {
    it('is false while pending', () => {
      expect(
        toAdditionalRequirementResponse(requirement(), MANAGER).isReviewed,
      ).toBe(false);
    });

    it.each([
      AdditionalRequirementStatus.APPROVED,
      AdditionalRequirementStatus.REJECTED,
    ])('is true once %s', (status) => {
      // A rejection is a decision too. Treating only APPROVED as reviewed
      // would leave rejected requirements looking like open work.
      expect(
        toAdditionalRequirementResponse(requirement({ status }), MANAGER)
          .isReviewed,
      ).toBe(true);
    });
  });

  describe('changedProjectPlan', () => {
    it('is false when an approval moved neither the estimate nor the deadline', () => {
      // A real outcome: the work was accepted as absorbed. Inferring this from
      // two nulls is how a client gets it wrong.
      const absorbed = requirement({
        status: AdditionalRequirementStatus.APPROVED,
        approvedAdditionalHours: null,
        deadlineExtensionDays: null,
      });
      expect(
        toAdditionalRequirementResponse(absorbed, MANAGER).changedProjectPlan,
      ).toBe(false);
    });

    it('is true when either moved', () => {
      expect(
        toAdditionalRequirementResponse(
          requirement({ approvedAdditionalHours: 8 }),
          MANAGER,
        ).changedProjectPlan,
      ).toBe(true);
      expect(
        toAdditionalRequirementResponse(
          requirement({ deadlineExtensionDays: 3 }),
          MANAGER,
        ).changedProjectPlan,
      ).toBe(true);
    });

    it('is false for an explicit zero, which changed nothing', () => {
      expect(
        toAdditionalRequirementResponse(
          requirement({ approvedAdditionalHours: 0, deadlineExtensionDays: 0 }),
          MANAGER,
        ).changedProjectPlan,
      ).toBe(false);
    });
  });

  describe('capabilities', () => {
    it('lets a manager review a pending requirement', () => {
      expect(
        toAdditionalRequirementResponse(requirement(), MANAGER).capabilities
          .canReview,
      ).toBe(true);
    });

    it('refuses a reader', () => {
      expect(
        toAdditionalRequirementResponse(requirement(), READER).capabilities
          .canReview,
      ).toBe(false);
    });

    it('closes once reviewed, because a decision is final', () => {
      const reviewed = requirement({
        status: AdditionalRequirementStatus.APPROVED,
        reviewedAt: AT,
      });
      expect(
        toAdditionalRequirementResponse(reviewed, MANAGER).capabilities
          .canReview,
      ).toBe(false);
    });
  });

  it('passes the opaque AI analysis through untouched', () => {
    const analysis = { verdict: 'in-scope', confidence: 0.8 };
    expect(
      toAdditionalRequirementResponse(
        requirement({ aiScopeAnalysis: analysis }),
        MANAGER,
      ).aiScopeAnalysis,
    ).toEqual(analysis);
  });
});
