import { ProjectStatusReport } from '@prisma/client';

import { toStatusReportResponse } from './project-status-report.mapper';

const report = {
  id: 'sr1',
  projectId: 'p1',
  requestedById: 'u1',
  reportType: 'STATUS_UPDATE',
  content: '## Status\nOn track.',
  periodStart: new Date('2026-08-07T00:00:00.000Z'),
  periodEnd: new Date('2026-08-13T00:00:00.000Z'),
  model: 'claude-sonnet-5',
  templateId: null,
  createdAt: new Date('2026-08-13T09:00:00.000Z'),
} as ProjectStatusReport;

describe('toStatusReportResponse', () => {
  it('renders the period as calendar dates, not instants', () => {
    // The period a report covers is a range of days. Sending instants would
    // make a reader in another timezone see a different week.
    const result = toStatusReportResponse(report);
    expect(result.periodStart).toBe('2026-08-07');
    expect(result.periodEnd).toBe('2026-08-13');
  });

  it('keeps the model that wrote it', () => {
    // Recorded so a report can be judged against what produced it, and so a
    // model change is visible in the history rather than silent.
    expect(toStatusReportResponse(report).model).toBe('claude-sonnet-5');
  });

  it('carries the markdown content unchanged', () => {
    expect(toStatusReportResponse(report).content).toBe('## Status\nOn track.');
  });

  it('reports a null template rather than omitting the field', () => {
    expect(toStatusReportResponse(report).templateId).toBeNull();
  });

  it('keeps a template id when one shaped the report', () => {
    expect(
      toStatusReportResponse({ ...report, templateId: 't1' }).templateId,
    ).toBe('t1');
  });
});
