import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { PaginatedAuditLogResponseDto } from '@/audit-log/dto/audit-log.dto';

const gatedErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: BadRequestErrorDto,
  }),
  ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorDto,
  }),
  ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ForbiddenErrorDto,
  }),
  ApiResponse({ status: 500, type: InternalServerErrorDto }),
];

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
