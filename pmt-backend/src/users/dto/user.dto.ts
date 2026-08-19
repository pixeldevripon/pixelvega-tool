import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permission, Role, UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * SYSTEM_ADMIN is excluded from both request DTOs below.
 *
 * This is LOAD BEARING, not cosmetic. `UsersService.update()` blocks promoting
 * anyone to ADMIN unless the actor is SYSTEM_ADMIN, but it does NOT check for
 * `dto.role === SYSTEM_ADMIN` at all. This validator is therefore the only
 * thing standing between an ADMIN and granting someone the root role. Do not
 * relax it to `@IsEnum(Role)`. `users.service.ts` carries a matching
 * defence-in-depth check so the boundary does not rest on validation alone.
 */
const ASSIGNABLE_ROLES = Object.values(Role).filter(
  (role) => role !== Role.SYSTEM_ADMIN,
);

// ── Response DTOs ────────────────────────────────────────────────────────────

/**
 * What every user endpoint returns. Mirrors USER_SELECT in users.service.ts:
 * that `select` and this class are the same contract stated twice, so change
 * them together. Deliberately absent: anything from the Account table, which is
 * where credential hashes live.
 */
export class UserResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'developer@pixelvega.com' })
  email!: string;

  @ApiProperty({ example: 'Jabed Hossain' })
  name!: string;

  @ApiProperty({ enum: Role, example: Role.DEVELOPER })
  role!: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiPropertyOptional({
    example: 'U08ABCDEF',
    nullable: true,
    description:
      'Cached Slack member id, resolved from the email on first use.',
  })
  slackUserId!: string | null;

  @ApiProperty({
    example: false,
    description:
      'True until an invited user completes their first password change. The frontend uses it to force the change-password screen.',
  })
  mustResetPassword!: boolean;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
    description: 'Who invited this user. Null for the bootstrap system admin.',
  })
  createdById!: string | null;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-19T14:32:00.000Z' })
  updatedAt!: Date;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  items!: UserResponseDto[];

  @ApiProperty({
    example: 137,
    description: 'Total across every page, not this page.',
  })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

export class MyPermissionsResponseDto {
  @ApiProperty({ enum: Role, example: Role.PROJECT_MANAGER })
  role!: Role;

  @ApiProperty({
    enum: Permission,
    isArray: true,
    example: [Permission.CREATE_PROJECT, Permission.VIEW_ALL_PROJECTS],
    description:
      'The effective capability set for this session. A client gates its UI from this, never from the role string.',
  })
  permissions!: Permission[];
}

export class MessageResponseDto {
  @ApiProperty({ example: 'User deleted.' })
  message!: string;
}

// ── Query DTOs ───────────────────────────────────────────────────────────────

export class QueryUsersDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

/**
 * SYSTEM_ADMIN is deliberately absent from the allowed roles: there is exactly
 * one, bootstrapped on first boot, and no API path creates a second.
 */
export class InviteUserRequestDto {
  @ApiProperty({ example: 'newhire@pixelvega.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'New Hire', minLength: 1, maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    enum: [
      Role.ADMIN,
      Role.PROJECT_MANAGER,
      Role.DEVELOPER,
      Role.DESIGNER,
      Role.CLIENT,
    ],
    example: Role.DEVELOPER,
    description: 'Only SYSTEM_ADMIN may invite an ADMIN.',
  })
  @IsEnum(Role)
  role!: Role;
}

export class UpdateUserRequestDto {
  @ApiPropertyOptional({ example: 'Jabed Hossain', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    enum: ASSIGNABLE_ROLES,
    description:
      'Nobody may change their own role, only SYSTEM_ADMIN may set ADMIN, and SYSTEM_ADMIN is never assignable.',
  })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    example: 'U0A4355VDGD',
    description:
      "Manual override for this user's Slack member id, for the case where their email does not match their Slack account so automatic lookup can never resolve it. Normally left unset: SlackUserResolverService fills it in the first time it is needed.",
  })
  @IsOptional()
  @IsString()
  slackUserId?: string;
}

export class ChangeOwnPasswordRequestDto {
  @ApiProperty({
    description: 'Must match the password currently on the account.',
  })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
