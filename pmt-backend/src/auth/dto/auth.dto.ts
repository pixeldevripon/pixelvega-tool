import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

/**
 * The reply to a reset code request.
 *
 * Deliberately identical whether or not the email matched an account. Telling a
 * caller which addresses exist turns this endpoint into an account enumeration
 * oracle, so the message is fixed and the wording says so plainly.
 */
export class ForgotPasswordResponseDto {
  @ApiProperty({
    example: 'If an account exists for this email, a reset code has been sent.',
    description:
      'Fixed text. Identical for a known and an unknown email, on purpose.',
  })
  message!: string;
}

export class VerifyResetCodeResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description:
      'Short lived. Pass to /auth-flows/reset-password as resetToken.',
  })
  resetToken!: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({ example: 'Password has been reset.' })
  message!: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@pixelvega.com' })
  @IsEmail()
  email!: string;
}

export class VerifyResetCodeDto {
  @ApiProperty({ example: 'admin@pixelvega.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @Length(6, 6)
  code!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token returned by /auth-flows/verify-reset-code',
  })
  @IsString()
  resetToken!: string;

  @ApiProperty({ minLength: 8 })
  @MinLength(8)
  newPassword!: string;
}
