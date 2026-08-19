import { ApiProperty } from '@nestjs/swagger';

/**
 * The shape every error response takes, produced by AllExceptionsFilter.
 *
 * These classes exist so Swagger can document what a failure looks like, not
 * only what a success looks like. Reference them from a controller with
 * `type:`, never an inline `schema:`.
 */
class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: '2026-08-20T09:12:33.001Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/projects' })
  path!: string;

  @ApiProperty({
    example: 'Validation failed',
    description:
      'Human readable. Safe to show a user verbatim. May be an array of strings when a DTO fails several rules at once.',
  })
  message!: string | string[];
}

export class BadRequestErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number = 400;
}

export class UnauthorizedErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode: number = 401;

  @ApiProperty({ example: 'Unauthorized' })
  message: string = 'Unauthorized';
}

export class ForbiddenErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 403 })
  statusCode: number = 403;

  @ApiProperty({ example: 'You are not an active member of this project' })
  message: string = 'Forbidden';
}

export class NotFoundErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number = 404;

  @ApiProperty({ example: 'Project not found' })
  message: string = 'Not Found';
}

export class ConflictErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 409 })
  statusCode: number = 409;

  @ApiProperty({
    example:
      'You already have a timer running on project abc, stop or pause it before starting another',
  })
  message: string = 'Conflict';
}

export class TooManyRequestsErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 429 })
  statusCode: number = 429;

  @ApiProperty({ example: 'ThrottlerException: Too Many Requests' })
  message: string = 'Too Many Requests';
}

export class InternalServerErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 500 })
  statusCode: number = 500;

  @ApiProperty({ example: 'Internal server error' })
  message: string = 'Internal server error';
}
