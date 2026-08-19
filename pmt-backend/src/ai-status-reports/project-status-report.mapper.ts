import { ProjectStatusReport } from '@prisma/client';

import { StatusReportResponseDto } from './dto/project-status-report.dto';

/** The report period is a calendar range, not a pair of instants. */
function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toStatusReportResponse(
  report: ProjectStatusReport,
): StatusReportResponseDto {
  return {
    id: report.id,
    projectId: report.projectId,
    requestedById: report.requestedById,
    reportType: report.reportType,
    content: report.content,
    periodStart: toDateOnlyString(report.periodStart),
    periodEnd: toDateOnlyString(report.periodEnd),
    model: report.model,
    templateId: report.templateId,
    createdAt: report.createdAt,
  };
}
