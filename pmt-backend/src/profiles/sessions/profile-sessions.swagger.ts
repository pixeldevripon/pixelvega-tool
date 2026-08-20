import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

import { gatedErrors, notFound } from '@/common/swagger/error-sets';
import {
  RevokedSessionsResponseDto,
  SessionResponseDto,
} from '@/profiles/sessions/dto/profile-sessions.dto';

export const ApiListOwnSessionsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Where the caller is currently signed in',
      description:
        'Newest first, and expired sessions are excluded rather than shown greyed: better-auth does not delete a session when it expires, ' +
        'so the table holds months of dead rows and a list including them is one nobody can read a real intrusion off. ' +
        'The user agent is parsed here rather than in a browser, so two clients cannot disagree about what a device is called. ' +
        'The session token is never on the response: it is a bearer credential.',
    }),
    ApiResponse({ status: 200, type: [SessionResponseDto] }),
    ...gatedErrors,
  );

export const ApiRevokeOwnSessionDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Sign one device out',
      description:
        'Scoped to the caller in the query itself, so a session id belonging to someone else answers 404 rather than revealing that it exists. ' +
        "The session making the request is refused: signing yourself out from a device list is the sign-out button's job, " +
        'and a Revoke that logs you out of the page you are on reads as a bug. Returns the remaining sessions.',
    }),
    ApiParam({ name: 'sessionId', description: 'The session id' }),
    ApiResponse({ status: 200, type: [SessionResponseDto] }),
    ...gatedErrors,
    notFound('Session not found'),
  );

export const ApiRevokeOtherSessionsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Sign out everywhere else',
      description:
        'Destroys every session except the one making the request. Deliberately not "everywhere including here": ' +
        'that is the sign-out button, and merging the two would mean the control that promises to keep you signed in on this device sometimes does not.',
    }),
    ApiResponse({ status: 200, type: RevokedSessionsResponseDto }),
    ...gatedErrors,
  );
