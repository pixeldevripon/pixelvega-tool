import { ApiResponse } from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  TooManyRequestsErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';

/**
 * The error response sets every module's swagger file composes from.
 *
 * The reference backend defines these per swagger file. Here they are shared,
 * because they were byte identical in all of them and a set that is copied
 * twenty seven times is one that drifts: adding a documented status would mean
 * remembering twenty seven edits. A module that genuinely needs a different set
 * spreads one of these and appends, which keeps the difference visible.
 */

export const serverError = ApiResponse({
  status: 500,
  type: InternalServerErrorDto,
});

export const notFound = (description = 'Not found') =>
  ApiResponse({ status: 404, description, type: NotFoundErrorDto });

export const conflict = (description = 'Conflict') =>
  ApiResponse({ status: 409, description, type: ConflictErrorDto });

export const throttled = ApiResponse({
  status: 429,
  description: 'Rate limited',
  type: TooManyRequestsErrorDto,
});

/** Any authenticated route: a malformed body or a missing session. */
export const commonErrors = [
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
  serverError,
];

/** Any route behind a permission, which can therefore answer 403. */
export const gatedErrors = [
  ...commonErrors,
  ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ForbiddenErrorDto,
  }),
];

/**
 * Any route scoped to one project. 403 when the caller is not a member of it,
 * 404 when the project itself does not exist.
 */
export const projectScopedErrors = [
  ...gatedErrors,
  notFound('Project not found'),
];
