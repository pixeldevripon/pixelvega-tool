import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { gatedErrors, projectScopedErrors } from '@/common/swagger/error-sets';
import {
  DeveloperReportResponseDto,
  ProjectReportResponseDto,
} from '@/project-reports/dto/project-report.dto';

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

export const ApiGetDeveloperReportDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get the calculated activity report for one person',
      description:
        'Plain aggregated numbers over a date range: hours worked (project and ' +
        'meeting), plan and wrap up compliance, blockers touched, leave taken, and ' +
        'projects worked on. No AI involved. A DEVELOPER or DESIGNER can only view ' +
        'their own; a PROJECT_MANAGER or admin may pass userId to view anyone.',
    }),
    ApiResponse({
      status: 200,
      description: 'The calculated report for the range',
      type: DeveloperReportResponseDto,
    }),
    ...gatedErrors,
  );
