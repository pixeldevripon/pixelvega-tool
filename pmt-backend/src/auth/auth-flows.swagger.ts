import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  InternalServerErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { throttled } from '@/common/swagger/error-sets';

/**
 * The custom forgot and reset password journey.
 *
 * This is NOT better-auth's own flow: it uses a six digit emailed code rather
 * than a link, so it is three explicit steps. Every route is public, because
 * someone who cannot sign in is precisely who needs it, which is why each one is
 * rate limited tighter than the global default.
 *
 * The public error set is deliberately narrow: no 401 for a wrong email, because
 * these endpoints must not reveal whether an account exists.
 */
const publicErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: BadRequestErrorDto,
  }),
  throttled,
  ApiResponse({ status: 500, type: InternalServerErrorDto }),
];

export const ApiForgotPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Request a password reset code',
      description:
        'Emails a six digit code that expires in ten minutes. The response is the same ' +
        'whether or not the address belongs to an account, so this cannot be used to ' +
        'enumerate users. Rate limited to 3 requests per 60 seconds.',
    }),
    ApiResponse({
      status: 200,
      description: 'Accepted, whether or not the account exists',
    }),
    ...publicErrors,
  );

export const ApiVerifyResetCodeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Verify a six digit reset code',
      description:
        'Exchanges a valid code for a short lived resetToken. The code is single use: ' +
        'a second attempt with the same one fails. Rate limited to 5 per 60 seconds.',
    }),
    ApiResponse({ status: 200, description: 'The resetToken' }),
    ApiResponse({
      status: 401,
      description: 'Invalid or expired code',
      type: UnauthorizedErrorDto,
    }),
    ...publicErrors,
  );

export const ApiResetPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Reset the password using a verified resetToken',
      description:
        'Updates the credential password, clears mustResetPassword, and writes a ' +
        'user.password_reset audit row with the user as both actor and target. The ' +
        'token expires ten minutes after it was issued.',
    }),
    ApiResponse({ status: 200, description: 'Password reset' }),
    ApiResponse({
      status: 401,
      description: 'Invalid or expired token',
      type: UnauthorizedErrorDto,
    }),
    ...publicErrors,
  );
