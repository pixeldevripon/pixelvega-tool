import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AvailabilityStatus, EmployeeWorkStatus, Role } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { EnumDisplayDto } from '@/common/dto/display.dto';
import * as FieldLength from '@/common/constants/field-lengths';

const WORK_STATUSES = Object.values(EmployeeWorkStatus);
const AVAILABILITY_STATUSES = Object.values(AvailabilityStatus);

// ── Response DTOs ────────────────────────────────────────────────────────────

/**
 * The staff profile. Which of the two profile tables applies is derived live
 * from User.role, there is no stored flag, so exactly one of employeeProfile
 * and clientProfile is ever populated on a response.
 */
export class EmployeeProfileResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  userId!: string;

  @ApiPropertyOptional({ example: 'Senior Developer', nullable: true })
  designation!: string | null;

  @ApiPropertyOptional({ example: '+8801700000000', nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'Asia/Dhaka', nullable: true })
  timezone!: string | null;

  @ApiPropertyOptional({
    example: 'Full stack, mostly WordPress.',
    nullable: true,
  })
  bio!: string | null;

  @ApiProperty({
    type: EnumDisplayDto,
    description: 'Whether they are working or on leave right now.',
  })
  currentStatus!: EnumDisplayDto;

  @ApiProperty({
    type: EnumDisplayDto,
    description:
      'An informational staffing signal only. Adding someone to a project is never blocked by it.',
  })
  availabilityStatus!: EnumDisplayDto;
}

export class ClientProfileResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  userId!: string;

  @ApiPropertyOptional({ example: 'Acme Ltd', nullable: true })
  companyName!: string | null;

  @ApiPropertyOptional({ example: 'billing@acme.com', nullable: true })
  billingEmail!: string | null;

  @ApiPropertyOptional({ example: '+8801700000000', nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'Asia/Dhaka', nullable: true })
  timezone!: string | null;
}

export class ProfileResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'developer@pixelvega.com' })
  email!: string;

  @ApiProperty({ example: 'Jabed Hossain' })
  name!: string;

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/pixelvega/image/upload/v1/avatars/abc.jpg',
    nullable: true,
    description:
      'Lives on User, shared across both profile types. Set via POST /profiles/me/avatar.',
  })
  avatarUrl!: string | null;

  @ApiProperty({ type: EnumDisplayDto })
  role!: EnumDisplayDto;

  @ApiPropertyOptional({
    type: EmployeeProfileResponseDto,
    nullable: true,
    description:
      'Populated for ADMIN, PROJECT_MANAGER, DEVELOPER and DESIGNER. Null for a CLIENT.',
  })
  employeeProfile!: EmployeeProfileResponseDto | null;

  @ApiPropertyOptional({
    type: ClientProfileResponseDto,
    nullable: true,
    description: 'Populated for a CLIENT. Null for everyone else.',
  })
  clientProfile!: ClientProfileResponseDto | null;
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

/**
 * A superset of both profile tables. ProfilesService picks the subset relevant
 * to the caller's role and ignores the rest, so sending a client-only field as
 * a developer is a no-op rather than an error.
 *
 * avatarUrl is deliberately absent: each upload creates a new Cloudinary asset
 * and deletes the previous one, which is not idempotent, so it is POST
 * /profiles/me/avatar rather than a field here.
 */
export class UpdateProfileRequestDto {
  @ApiPropertyOptional({ example: 'Jabed Hossain', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Employee only', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @ApiPropertyOptional({ description: 'Employee or Client', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Employee or Client',
    example: 'Asia/Dhaka',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ description: 'Employee only', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ enum: WORK_STATUSES, description: 'Employee only' })
  @IsOptional()
  @IsEnum(EmployeeWorkStatus)
  currentStatus?: EmployeeWorkStatus;

  @ApiPropertyOptional({
    enum: AVAILABILITY_STATUSES,
    description: 'Employee only',
  })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;

  @ApiPropertyOptional({ description: 'Client only', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @ApiPropertyOptional({ description: 'Client only' })
  @IsOptional()
  @IsEmail()
  @MaxLength(FieldLength.EMAIL)
  billingEmail?: string;
}
