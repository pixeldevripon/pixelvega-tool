import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { gatedErrors } from '@/common/swagger/error-sets';
import { DeveloperReportResponseDto } from '@/reports/developers/dto/developer-report.dto';

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
