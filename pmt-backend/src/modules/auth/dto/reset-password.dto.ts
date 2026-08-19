import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token returned by /auth-flows/verify-reset-code',
  })
  @IsString()
  resetToken: string;

  @ApiProperty({ minLength: 8 })
  @MinLength(8)
  newPassword: string;
}
