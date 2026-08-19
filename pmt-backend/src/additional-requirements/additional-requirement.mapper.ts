import {
  AdditionalRequirement,
  AdditionalRequirementStatus,
  User,
} from '@prisma/client';

import {
  ADDITIONAL_REQUIREMENT_STATUS_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

import { AdditionalRequirementResponseDto } from './dto/additional-requirement.dto';

type RequirementUser = Pick<User, 'id' | 'name' | 'email'>;

export type AdditionalRequirementWithRelations = AdditionalRequirement & {
  uploadedBy: RequirementUser;
  reviewedBy: RequirementUser | null;
};

export type AdditionalRequirementContext = {
  /** Does the caller manage this project? Only a manager reviews. */
  managesProject: boolean;
};

export function toAdditionalRequirementResponse(
  requirement: AdditionalRequirementWithRelations,
  context: AdditionalRequirementContext,
): AdditionalRequirementResponseDto {
  const isReviewed =
    requirement.status !== AdditionalRequirementStatus.PENDING_REVIEW;

  return {
    id: requirement.id,
    projectId: requirement.projectId,
    description: requirement.description,
    sourceChannel: requirement.sourceChannel,
    status: toEnumDisplay(
      ADDITIONAL_REQUIREMENT_STATUS_DISPLAY,
      requirement.status,
    ),
    uploadedBy: requirement.uploadedBy,
    reviewedBy: requirement.reviewedBy,
    reviewedAt: requirement.reviewedAt,
    isReviewed,
    approvedAdditionalHours: requirement.approvedAdditionalHours,
    deadlineExtensionDays: requirement.deadlineExtensionDays,
    // An approval that changed neither the estimate nor the deadline is a real
    // outcome: the work was accepted as absorbed. Saying so explicitly stops a
    // client inferring it from two nulls and getting it wrong.
    changedProjectPlan:
      (requirement.approvedAdditionalHours ?? 0) > 0 ||
      (requirement.deadlineExtensionDays ?? 0) > 0,
    aiScopeAnalysis: requirement.aiScopeAnalysis,
    createdAt: requirement.createdAt,
    updatedAt: requirement.updatedAt,
    capabilities: {
      // A decision is final. Reviewing an already reviewed requirement is the
      // conflict the service raises, so the flag closes once reviewed.
      canReview: context.managesProject && !isReviewed,
    },
  };
}
