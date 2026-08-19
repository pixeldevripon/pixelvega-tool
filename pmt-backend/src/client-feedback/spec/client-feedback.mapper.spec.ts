import { ClientFeedbackDecision } from '@prisma/client';

import {
  ClientFeedbackWithRelations,
  toClientFeedbackResponse,
} from '../client-feedback.mapper';

const AT = new Date('2026-08-12T09:00:00.000Z');
const CLIENT = { id: 'c1', name: 'Acme Ltd', email: 'ops@acme.com' };
const MANAGER = {
  id: 'u1',
  name: 'Rezina Akter',
  email: 'rezina@pixelvega.com',
};

function feedback(
  overrides: Partial<ClientFeedbackWithRelations> = {},
): ClientFeedbackWithRelations {
  return {
    id: 'f1',
    projectId: 'p1',
    clientId: 'c1',
    recordedById: null,
    decision: ClientFeedbackDecision.APPROVED,
    comments: null,
    feedbackRound: 1,
    createdAt: AT,
    client: CLIENT,
    recordedBy: null,
    ...overrides,
  };
}

describe('toClientFeedbackResponse', () => {
  it('returns the decision as a display object', () => {
    expect(toClientFeedbackResponse(feedback()).decision).toEqual({
      value: 'APPROVED',
      label: 'Approved',
      tone: 'success',
    });
  });

  describe('wasRecordedOnBehalf', () => {
    it('is false when the client submitted it themselves', () => {
      const result = toClientFeedbackResponse(feedback());
      expect(result.wasRecordedOnBehalf).toBe(false);
      expect(result.recordedBy).toBeNull();
    });

    it('is true when a manager wrote it down for them', () => {
      // Material on an approval: "the client approved" and "a manager says the
      // client approved" are different claims, and a client should not have to
      // infer which one it is holding from a null.
      const onBehalf = feedback({ recordedById: 'u1', recordedBy: MANAGER });
      const result = toClientFeedbackResponse(onBehalf);
      expect(result.wasRecordedOnBehalf).toBe(true);
      expect(result.recordedBy).toEqual(MANAGER);
    });
  });

  it('marks only the first round as the one that moved the project', () => {
    expect(
      toClientFeedbackResponse(feedback({ feedbackRound: 1 })).isFirstRound,
    ).toBe(true);
    expect(
      toClientFeedbackResponse(feedback({ feedbackRound: 2 })).isFirstRound,
    ).toBe(false);
  });

  it('tones requested changes as a warning', () => {
    const changes = feedback({
      decision: ClientFeedbackDecision.CHANGES_REQUESTED,
    });
    expect(toClientFeedbackResponse(changes).decision.tone).toBe('warning');
  });
});
