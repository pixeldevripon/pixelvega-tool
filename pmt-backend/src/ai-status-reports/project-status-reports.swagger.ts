import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { projectScopedErrors } from '@/common/swagger/error-sets';
import {
  QueuedStatusReportResponseDto,
  StatusReportResponseDto,
} from '@/ai-status-reports/dto/project-status-report.dto';

const projectIdParam = ApiParam({
  name: 'projectId',
  description: 'The project id',
});

export const ApiGenerateStatusReportDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Generate a saved AI status report for a project',
      description:
        'Queued, not synchronous: returns a jobId to poll at GET /ai-jobs/:id. The ' +
        'period defaults to since the last status report, or the last seven days if ' +
        'there has never been one. Unlike the prose summary this includes both plan ' +
        'and accomplishments, so it shows planned against delivered, and it reuses the ' +
        'calculated project report rather than recomputing those numbers. Every ' +
        'generation appends a new row; nothing is overwritten.',
    }),
    projectIdParam,
    ApiResponse({
      status: 202,
      description: 'The queued job id',
      type: QueuedStatusReportResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiListStatusReportsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List a project's AI status report history, newest first",
      description:
        'Append only, so every previously generated report stays readable.',
    }),
    projectIdParam,
    ApiResponse({
      status: 200,
      description: 'Paginated status reports',
      type: [StatusReportResponseDto],
    }),
    ...projectScopedErrors,
  );
