import { json, urlencoded } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Comfortably larger than the biggest text field any DTO accepts
 * (`FieldLength.DOCUMENT_TEXT`, 50k characters) and far smaller than anything
 * that could pressure memory. File uploads do not come through here: multer
 * handles `multipart/form-data` per route, with its own size limits.
 */
const BODY_LIMIT = '1mb';

/**
 * Parses request bodies for every route EXCEPT `/api/auth`.
 *
 * better-auth reads the raw request stream. A parser that has already consumed
 * it is the documented cause of its client API hanging, which is why
 * `NestFactory.create` is given `bodyParser: false` and why this exists instead:
 * turning the parser off globally would leave every DTO with an empty body and
 * `ValidationPipe` with nothing to validate.
 *
 * This is the same arrangement better-auth's Express guide describes ("apply
 * express.json() only to routes that do not interact with Better Auth"), and the
 * same thing the NestJS adapter package this replaced did internally.
 */
export function bodyParsersExceptAuth(authBasePath: string): RequestHandler {
  const parseJson = json({ limit: BODY_LIMIT });
  const parseUrlEncoded = urlencoded({ extended: true, limit: BODY_LIMIT });

  return (request: Request, response: Response, next: NextFunction) => {
    if (
      request.path === authBasePath ||
      request.path.startsWith(`${authBasePath}/`)
    ) {
      next();
      return;
    }

    parseJson(request, response, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      parseUrlEncoded(request, response, next);
    });
  };
}
