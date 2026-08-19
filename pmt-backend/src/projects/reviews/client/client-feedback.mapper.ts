import { ClientFeedback, ClientFeedbackDecision, User } from '@prisma/client';

import {
  CLIENT_FEEDBACK_DECISION_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

import { ClientFeedbackResponseDto } from './dto/client-feedback.dto';

type FeedbackUser = Pick<User, 'id' | 'name' | 'email'>;

export type ClientFeedbackWithRelations = ClientFeedback & {
  client: FeedbackUser;
  recordedBy: FeedbackUser | null;
};

export function toClientFeedbackResponse(
  feedback: ClientFeedbackWithRelations,
): ClientFeedbackResponseDto {
  return {
    id: feedback.id,
    projectId: feedback.projectId,
    decision: toEnumDisplay(
      CLIENT_FEEDBACK_DECISION_DISPLAY,
      feedback.decision,
    ),
    comments: feedback.comments,
    feedbackRound: feedback.feedbackRound,
    isFirstRound: feedback.feedbackRound === 1,
    client: feedback.client,
    recordedBy: feedback.recordedBy,
    // Whether the client said this themselves or a manager wrote it down for
    // them is a material difference on an approval, so it is stated rather than
    // left for a client to infer from a null.
    wasRecordedOnBehalf: feedback.recordedBy !== null,
    createdAt: feedback.createdAt,
  };
}
