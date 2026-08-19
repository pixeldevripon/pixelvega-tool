import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { gatedErrors, notFound } from '@/common/swagger/error-sets';

export const ApiGetAiJobDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Poll a queued AI job',
      description:
        'Reports a CHECK_SCOPE or GENERATE_STATUS_REPORT job as it moves through ' +
        'QUEUED, PROCESSING and then COMPLETED or FAILED. On success resultRefId ' +
        'points at whatever the job produced. Access is checked against whatever the ' +
        'underlying feature would have required, so polling a job cannot reveal ' +
        'anything the caller could not have requested themselves.',
    }),
    ApiParam({ name: 'id', description: 'The AI job id' }),
    ApiResponse({ status: 200, description: 'The job and its current status' }),
    ...gatedErrors,
    notFound('Job not found'),
  );
