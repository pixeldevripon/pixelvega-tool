import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Turn a constraint name like "project_members_projectId_fkey" into a noun a
 * user can act on ("existing project members"). Prisma reports it under
 * `meta.constraint` on newer engines and `meta.field_name` on older ones.
 */
function foreignKeyNoun(meta: Record<string, unknown> | undefined): string {
  const raw =
    typeof meta?.constraint === 'string'
      ? meta.constraint
      : typeof meta?.field_name === 'string'
        ? meta.field_name
        : '';
  const table = raw
    .replace(/_[A-Za-z]+_fkey$/, '')
    .replaceAll('_', ' ')
    .trim();
  return table ? `existing ${table}` : 'other records';
}

/**
 * Prisma constraint violations are almost always USER caused: deleting
 * something still referenced, creating a duplicate, or acting on a row someone
 * else already removed. As plain Errors they would fall through this filter as
 * a bare 500, which is both a poor experience and a diagnostic dead end. Map
 * the four actionable codes to readable HTTP errors; anything unrecognised
 * still becomes a generic 500.
 */
function mapPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): { status: number; message: string } | null {
  const meta = error.meta;
  switch (error.code) {
    case 'P2002': {
      const target = meta?.target;
      const fields = Array.isArray(target)
        ? (target as string[]).join(', ')
        : typeof target === 'string'
          ? target
          : '';
      return {
        status: HttpStatus.CONFLICT,
        message: fields
          ? `A record with the same ${fields} already exists.`
          : 'A record with the same unique value already exists.',
      };
    }
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        message: `This record is still linked to ${foreignKeyNoun(meta)}, so it cannot be deleted. Remove or reassign what depends on it first.`,
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        message:
          'That record no longer exists, it may have been deleted by someone else. Refresh and try again.',
      };
    case 'P2014':
      return {
        status: HttpStatus.CONFLICT,
        message:
          'The change would break a required link between records, so it was not applied.',
      };
    default:
      return null;
  }
}

/**
 * The single place an exception becomes an HTTP response.
 *
 * Registered globally in main.ts. Produces one stable envelope for every
 * failure, so a client never has to branch on which layer threw. Server errors
 * are logged with their stack; client errors are not, since they are expected.
 *
 * Mirrors the reference backend's `AllExceptionsFilter`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const prismaMapped =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? mapPrismaError(exception)
        : null;

    const status = prismaMapped
      ? prismaMapped.status
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message = prismaMapped
      ? prismaMapped.message
      : typeof body === 'string'
        ? body
        : typeof body === 'object' && body !== null && 'message' in body
          ? (body as Record<string, unknown>).message
          : 'Internal server error';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
