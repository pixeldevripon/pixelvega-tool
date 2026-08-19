import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';

// SYSTEM_ADMIN is excluded. It's a single account created only at
// bootstrap, and can never be assigned via this endpoint.
const ASSIGNABLE_ROLES = Object.values(Role).filter(
  (role) => role !== Role.SYSTEM_ADMIN,
);
const STATUSES = Object.values(UserStatus);

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES, example: 'PROJECT_MANAGER' })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: Role;

  @ApiPropertyOptional({ enum: STATUSES, example: 'ACTIVE' })
  @IsOptional()
  @IsIn(STATUSES)
  status?: UserStatus;

  @ApiPropertyOptional({
    example: 'U0A4355VDGD',
    description:
      "Manual override for this user's Slack user id, for the case where their email doesn't match their Slack account and automatic lookup can never resolve it. Normally left unset — SlackUserResolverService fills this in automatically the first time it's needed.",
  })
  @IsOptional()
  @IsString()
  slackUserId?: string;
}
