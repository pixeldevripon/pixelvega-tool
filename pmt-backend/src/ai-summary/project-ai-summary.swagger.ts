import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { projectScopedErrors } from '@/common/swagger/error-sets';

export const ApiGetProjectAiSummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Generate a prose AI summary of a project's status",
      description:
        'Synchronous, no queue, generated fresh on every call and never stored. ' +
        "Combines the project's PRD with everything reported as ACCOMPLISHMENTS in " +
        'the range, deliberately not plans, since a plan is stated intent that may ' +
        'not have happened. Adds the open blocker count and the core snapshot from ' +
        'the calculated project report. A project with nothing accomplished yet in ' +
        'range still returns 200 with a thin summary rather than an error.',
    }),
    ApiParam({ name: 'projectId', description: 'The project id' }),
    ApiResponse({ status: 200, description: 'The generated summary' }),
    ...projectScopedErrors,
  );
