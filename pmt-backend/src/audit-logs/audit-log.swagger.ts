import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { gatedErrors } from '@/common/swagger/error-sets';
import { PaginatedAuditLogResponseDto } from '@/audit-logs/dto/audit-log.dto';

export const ApiListAuditLogDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List audit log entries',
      description:
        'Paginated, newest first. Filterable by targetType, targetId and userId. ' +
        'userId is the ACTOR who performed the action, not the person it was done to. ' +
        'Entries are written explicitly at meaningful points rather than by a request ' +
        'interceptor, so this is a record of decisions, not of traffic.',
    }),
    ApiResponse({ status: 200, type: PaginatedAuditLogResponseDto }),
    ...gatedErrors,
  );
