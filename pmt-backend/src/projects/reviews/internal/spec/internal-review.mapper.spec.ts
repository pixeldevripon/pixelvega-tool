import { InternalReviewDecision } from '@prisma/client';

import {
  InternalReviewWithReviewer,
  toInternalReviewResponse,
} from '../internal-review.mapper';

const AT = new Date('2026-08-12T09:00:00.000Z');

function review(
  overrides: Partial<InternalReviewWithReviewer> = {},
): InternalReviewWithReviewer {
  return {
    id: 'rv1',
    projectId: 'p1',
    reviewedById: 'u1',
    decision: InternalReviewDecision.APPROVED,
    comments: null,
    reviewRound: 1,
    createdAt: AT,
    reviewedBy: {
      id: 'u1',
      name: 'Rezina Akter',
      email: 'rezina@pixelvega.com',
    },
    ...overrides,
  };
}

describe('toInternalReviewResponse', () => {
  it('returns the decision as a display object', () => {
    expect(toInternalReviewResponse(review()).decision).toEqual({
      value: 'APPROVED',
      label: 'Approved',
      tone: 'success',
    });
  });

  it('tones requested changes as a warning, not a failure', () => {
    // Requested changes are a normal review step. Reserving danger for
    // cancellation is what keeps danger meaningful on a board.
    const changes = review({
      decision: InternalReviewDecision.CHANGES_REQUIRED,
    });
    expect(toInternalReviewResponse(changes).decision.tone).toBe('warning');
  });

  describe('isFirstRound', () => {
    it('is true for round 1, the one that moved the project', () => {
      expect(
        toInternalReviewResponse(review({ reviewRound: 1 })).isFirstRound,
      ).toBe(true);
    });

    it('is false for every later round', () => {
      // Only the first round moves the project status, so a history screen
      // showing three rounds needs to know which one did something.
      expect(
        toInternalReviewResponse(review({ reviewRound: 2 })).isFirstRound,
      ).toBe(false);
      expect(
        toInternalReviewResponse(review({ reviewRound: 7 })).isFirstRound,
      ).toBe(false);
    });
  });

  it('carries the comments when there are any', () => {
    const withComments = review({
      decision: InternalReviewDecision.CHANGES_REQUIRED,
      comments: 'The contact form is missing the honeypot field',
    });
    expect(toInternalReviewResponse(withComments).comments).toBe(
      'The contact form is missing the honeypot field',
    );
  });
});
