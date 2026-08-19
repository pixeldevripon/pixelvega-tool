import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { VerifyResetCodeDto } from '@/auth/dto/verify-reset-code.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';

@ApiTags('Auth Flows')
@Controller('auth-flows')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Request a password reset code',
    description:
      'Public. Always returns a generic success message, whether or not the email exists. Rate-limited to 3/min.',
  })
  @ApiResponse({ status: 201, description: 'Code sent if the account exists' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @AllowAnonymous()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiOperation({
    summary: 'Verify a 6-digit reset code',
    description:
      'Public. On success, consumes the code and returns a short-lived resetToken for /reset-password. Rate-limited to 5/min.',
  })
  @ApiResponse({ status: 201, description: 'Returns a resetToken' })
  @ApiResponse({ status: 401, description: 'Invalid or expired code' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @AllowAnonymous()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('verify-reset-code')
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto.email, dto.code);
  }

  @ApiOperation({
    summary: 'Reset password using a verified resetToken',
    description: 'Public.',
  })
  @ApiResponse({ status: 201, description: 'Password reset' })
  @ApiResponse({ status: 401, description: 'Invalid or expired resetToken' })
  @AllowAnonymous()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }
}
