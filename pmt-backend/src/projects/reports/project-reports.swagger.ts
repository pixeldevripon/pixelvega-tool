import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { projectScopedErrors } from '@/common/swagger/error-sets';
import { ProjectReportResponseDto } from '@/projects/reports/dto/project-report.dto';

export const ApiGetProjectReportDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get the calculated activity report for a project',
      description:
        'Plain aggregated numbers over a date range: hours by member, blockers, ' +
        'additional requirements, internal review and client feedback outcomes, and ' +
        'daily work report compliance. No AI involved. This is the calculated ' +
        'counterpart to the AI status report, which reuses these numbers rather than ' +
        'recomputing them, so the two can never disagree.',
    }),
    ApiParam({ name: 'projectId', description: 'The project id' }),
    ApiResponse({
      status: 200,
      description: 'The calculated report for the range',
      type: ProjectReportResponseDto,
    }),
    ...projectScopedErrors,
  );
