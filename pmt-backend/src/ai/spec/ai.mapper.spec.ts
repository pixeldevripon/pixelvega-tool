import { AiJob, AiJobStatus, AiJobType, AiTemplateKind } from '@prisma/client';

import { toAiJobResponse, toAiTemplateResponse } from '../ai.mapper';

const AT = new Date('2026-08-12T09:00:00.000Z');

function job(overrides: Partial<AiJob> = {}): AiJob {
  return {
    id: 'j1',
    type: AiJobType.GENERATE_STATUS_REPORT,
    status: AiJobStatus.QUEUED,
    projectId: 'p1',
    requestedById: 'u1',
    input: { periodStart: '2026-08-01' },
    resultRefId: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: AT,
    ...overrides,
  };
}

describe('toAiJobResponse', () => {
  it('returns type and status as display objects', () => {
    const result = toAiJobResponse(job());
    expect(result.type).toEqual({
      value: 'GENERATE_STATUS_REPORT',
      label: 'Status report',
      tone: 'default',
    });
    expect(result.status).toEqual({
      value: 'QUEUED',
      label: 'Queued',
      tone: 'default',
    });
  });

  describe('isFinished', () => {
    it.each([AiJobStatus.QUEUED, AiJobStatus.PROCESSING])(
      'is false while %s',
      (status) => {
        expect(toAiJobResponse(job({ status })).isFinished).toBe(false);
      },
    );

    it.each([AiJobStatus.COMPLETED, AiJobStatus.FAILED])(
      'is true once %s',
      (status) => {
        // FAILED counts as finished. A client polling until COMPLETED would
        // poll a failed job forever, which is the bug this field prevents.
        expect(toAiJobResponse(job({ status })).isFinished).toBe(true);
      },
    );
  });

  it('passes the opaque input through untouched', () => {
    // Its shape belongs to the job type, not to this contract.
    const input = { requirementId: 'r1', nested: { deep: true } };
    expect(toAiJobResponse(job({ input })).input).toEqual(input);
  });

  it('carries the error message on a failed job', () => {
    const failed = job({
      status: AiJobStatus.FAILED,
      errorMessage: 'The model was unreachable.',
      finishedAt: AT,
    });
    const result = toAiJobResponse(failed);
    expect(result.errorMessage).toBe('The model was unreachable.');
    expect(result.status.tone).toBe('danger');
  });
});

describe('toAiTemplateResponse', () => {
  it('spells the kind properly rather than title casing the enum', () => {
    const template = {
      id: 't1',
      kind: AiTemplateKind.PROJECT_SUMMARY,
      name: 'Default project summary',
      content: '## Status',
      isDefault: true,
      createdById: 'u1',
      createdAt: AT,
      updatedAt: AT,
    };
    expect(toAiTemplateResponse(template).kind).toEqual({
      value: 'PROJECT_SUMMARY',
      label: 'Project summary',
      tone: 'default',
    });
  });
});
