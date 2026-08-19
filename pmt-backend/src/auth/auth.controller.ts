import { Body, Controller, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { VerifyResetCodeDto } from '@/auth/dto/verify-reset-code.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import {
  ApiForgotPasswordDocs,
  ApiResetPasswordDocs,
  ApiVerifyResetCodeDocs,
} from '@/auth/auth-flows.swagger';

@ApiTags('Auth Flows')
@Controller('auth-flows')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiForgotPasswordDocs()
  @AllowAnonymous()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiVerifyResetCodeDocs()
  @AllowAnonymous()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('verify-reset-code')
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto.email, dto.code);
  }

  @ApiResetPasswordDocs()
  @AllowAnonymous()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }
}
