import {
  InternalReviewDecision,
  ProjectInternalReview,
  User,
} from '@prisma/client';

import {
  INTERNAL_REVIEW_DECISION_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

import { InternalReviewResponseDto } from './dto/internal-review.dto';

export type InternalReviewWithReviewer = ProjectInternalReview & {
  reviewedBy: Pick<User, 'id' | 'name' | 'email'>;
};

export function toInternalReviewResponse(
  review: InternalReviewWithReviewer,
): InternalReviewResponseDto {
  return {
    id: review.id,
    projectId: review.projectId,
    decision: toEnumDisplay(INTERNAL_REVIEW_DECISION_DISPLAY, review.decision),
    comments: review.comments,
    reviewRound: review.reviewRound,
    // Only the first round moves the project status. A history screen showing
    // three rounds needs to know which one actually did something, and that is
    // a rule about the domain rather than a number a client should interpret.
    isFirstRound: review.reviewRound === 1,
    reviewedBy: review.reviewedBy,
    createdAt: review.createdAt,
  };
}
