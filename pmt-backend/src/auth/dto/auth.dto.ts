import { ApiProperty } from '@nestjs/swagger';

/**
 * The auth surface is better-auth's, not this application's.
 *
 * Sign-in, sign-out, forgot-password, reset-password and change-password are
 * all served by better-auth at `/api/auth/*`, so their request and response
 * bodies are its contract rather than ours and there are no DTOs for them here.
 * `common/swagger/better-auth-schema.ts` merges those paths into `/api/docs`.
 *
 * What remains is the one shape this application adds on top.
 */

/** A session, as `GET /api/auth/get-session` returns it. Documentation only. */
export class SessionUserDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  id!: string;

  @ApiProperty({ example: 'rezina@pixelvega.com' })
  email!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'DEVELOPER' })
  role!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({
    example: false,
    description:
      'True until the invited user has chosen their own password. The dashboard forces a password change while this is set.',
  })
  mustResetPassword!: boolean;
}
