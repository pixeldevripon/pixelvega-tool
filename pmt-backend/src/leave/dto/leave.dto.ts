import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { LeaveStatus, Role } from '@prisma/client';

import { ToArray } from '@/common/decorators/to-array.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { EnumDisplayDto } from '@/common/dto/display.dto';
import { ToBoolean } from '@/common/decorators/to-boolean.decorator';
import * as FieldLength from '@/common/constants/field-lengths';
import { IsNotBefore } from '@/common/validators/is-not-before.validator';

const LEAVE_TAKING_ROLES = [
  Role.PROJECT_MANAGER,
  Role.DEVELOPER,
  Role.DESIGNER,
];

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class LeaveUserDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'rezina@pixelvega.com' })
  email!: string;

  /**
   * Who is asking, which a reviewer needs: a project manager's absence and a
   * developer's are different problems to cover for.
   *
   * Optional because `reviewedBy` uses this same class and its query does not
   * select a role. Absent is therefore "not asked for", never "has none".
   *
   * It was ALREADY arriving, as the bare string `"DEVELOPER"`, because the list
   * query selects `role` and the mapper spread the row wholesale. Two defects in
   * one: an undeclared field in a response, and a bare enum (ADR 0001). A screen
   * reading `.label` off it rendered nothing. `whitelist` and
   * `forbidNonWhitelisted` guard request bodies, not responses, so nothing
   * caught it: the mapper now maps field by field instead of spreading.
   */
  @ApiPropertyOptional({ type: EnumDisplayDto })
  role?: EnumDisplayDto;
}

export class LeaveTypeResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Annual Leave' })
  name!: string;

  @ApiProperty({ example: 15 })
  defaultDaysPerYear!: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

export class HolidayResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Eid-ul-Fitr' })
  name!: string;

  @ApiProperty({
    example: '2026-03-19',
    description:
      'A calendar date. It carries no timezone, so do not render it in one.',
  })
  startDate!: string;

  @ApiProperty({
    example: '2026-03-21',
    description: 'Equal to startDate for a single day holiday.',
  })
  endDate!: string;

  @ApiProperty({
    example: 3,
    description: 'Inclusive day count, so a single day holiday is 1.',
  })
  days!: number;

  @ApiProperty({
    example: false,
    description: 'Whether the holiday has not started yet, relative to today.',
  })
  isUpcoming!: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

export class LeaveRequestCapabilitiesDto {
  @ApiProperty({
    example: true,
    description:
      'Whether this caller may approve it. Reviewers only, and only while PENDING.',
  })
  canApprove!: boolean;

  @ApiProperty({ example: true })
  canReject!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Whether this caller may cancel it. The requester alone, and that rule survives admin deliberately.',
  })
  canCancel!: boolean;
}

export class LeaveRequestResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiPropertyOptional({ type: LeaveUserDto })
  user?: LeaveUserDto;

  @ApiProperty({ type: LeaveTypeResponseDto })
  leaveType!: LeaveTypeResponseDto;

  @ApiProperty({ example: '2026-08-10' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-12' })
  endDate!: string;

  @ApiProperty({
    example: 3,
    description: 'Inclusive working day count, decided at request time.',
  })
  days!: number;

  @ApiPropertyOptional({ example: 'Family event', nullable: true })
  reason!: string | null;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiPropertyOptional({ type: LeaveUserDto, nullable: true })
  reviewedBy!: LeaveUserDto | null;

  @ApiPropertyOptional({ example: '2026-08-05T09:00:00.000Z', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({
    example: true,
    description: 'Whether the request is still awaiting a decision.',
  })
  isPending!: boolean;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: LeaveRequestCapabilitiesDto })
  capabilities!: LeaveRequestCapabilitiesDto;
}

export class PaginatedLeaveRequestsResponseDto {
  @ApiProperty({ type: [LeaveRequestResponseDto] })
  items!: LeaveRequestResponseDto[];

  @ApiProperty({ example: 9 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

export class LeaveBalanceResponseDto {
  @ApiProperty({ type: LeaveTypeResponseDto })
  leaveType!: LeaveTypeResponseDto;

  @ApiProperty({ example: 15 })
  allocatedDays!: number;

  @ApiProperty({ example: 4 })
  usedDays!: number;

  @ApiProperty({
    example: 11,
    description:
      'allocatedDays minus usedDays. Can go negative if leave was approved beyond the allocation, and is not clamped.',
  })
  remainingDays!: number;
}

export class LeaveSummaryRequestDto {
  @ApiProperty({ example: 'Annual Leave' })
  leaveType!: string;

  @ApiProperty({ example: '2026-08-10' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-12' })
  endDate!: string;

  @ApiProperty({ example: 3 })
  days!: number;

  @ApiPropertyOptional({ example: 'Family event', nullable: true })
  reason!: string | null;
}

export class LeaveSummaryUserDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'rezina@pixelvega.com' })
  email!: string;

  @ApiProperty({ type: EnumDisplayDto })
  role!: EnumDisplayDto;

  @ApiProperty({
    example: { 'Annual Leave': 4, 'Sick Leave': 1 },
    description:
      'Days per leave type name. Every type in the report appears as a key, zero included, so a table has no gaps to fill in.',
    additionalProperties: { type: 'number' },
  })
  byLeaveType!: Record<string, number>;

  @ApiProperty({ example: 5 })
  totalDays!: number;

  @ApiPropertyOptional({
    type: [LeaveSummaryRequestDto],
    description: 'Present only when includeDetails is set. Oldest first.',
  })
  requests?: LeaveSummaryRequestDto[];
}

export class LeaveSummaryTypeDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Annual Leave' })
  name!: string;
}

/**
 * The leave summary report.
 *
 * `users` arrives sorted by name, and `byLeaveType` carries a key for every
 * type in the report even when the count is zero. Both are deliberate: a client
 * renders this table straight, with no sorting and no gap filling (D4).
 */
export class LeaveSummaryResponseDto {
  @ApiProperty({ example: '2026-01-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-12-31' })
  endDate!: string;

  @ApiProperty({ type: [LeaveSummaryTypeDto] })
  leaveTypes!: LeaveSummaryTypeDto[];

  @ApiProperty({ type: [LeaveSummaryUserDto] })
  users!: LeaveSummaryUserDto[];

  @ApiProperty({ example: 37 })
  grandTotalDays!: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

export class QueryLeaveRequestsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to a specific user' })
  @IsOptional()
  @IsString()
  // Bounded like its sibling on `QueryLeaveSummaryDto`. A better-auth user id
  // is not a UUID, so this cannot be `@IsUUID()`, but an unbounded string
  // reaching an equality clause still has no reason to be unbounded.
  @MaxLength(FieldLength.SINGLE_LINE)
  userId?: string;

  @ApiPropertyOptional({
    enum: LeaveStatus,
    description:
      'The one filter a review queue cannot work without: a reviewer opens this screen to answer "what is waiting for me", and 420 requests of which most are already decided is not that screen.',
  })
  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;

  @ApiPropertyOptional({ description: 'Filter to one kind of leave.' })
  @IsOptional()
  // A foreign key, and `CreateLeaveRequestDto.leaveTypeId` validates it as one.
  // A query filter accepting an arbitrary string for the same column is the
  // looser half of a promise the DTO is supposed to be (D5).
  @IsUUID()
  leaveTypeId?: string;
}

export class QueryLeaveSummaryDto {
  @ApiPropertyOptional({
    description:
      "Start of the date range, inclusive. Matched against each leave request's startDate. Defaults to January 1 of the current year.",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "End of the date range, inclusive. Matched against each leave request's startDate. Defaults to today.",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: LEAVE_TAKING_ROLES,
    isArray: true,
    example: [Role.DEVELOPER, Role.DESIGNER],
    description:
      'Comma separated (?role=DEVELOPER,DESIGNER) or repeated (?role=DEVELOPER&role=DESIGNER). Matches ANY of the given roles, not all of them. Only PROJECT_MANAGER, DEVELOPER, and DESIGNER can have leave requests.',
  })
  @IsOptional()
  @ToArray()
  @IsArray()
  @IsIn(LEAVE_TAKING_ROLES, { each: true })
  role?: Role[];

  @ApiPropertyOptional({
    description: 'Narrow the report to one specific user',
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
  userId?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Adds a requests array under each user with the exact startDate, endDate, leaveType, and reason for every leave request behind their totals, oldest first.',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeDetails?: boolean = false;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'Annual Leave' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 15 })
  @IsInt()
  @Min(0)
  defaultDaysPerYear!: number;
}

export class UpdateLeaveTypeDto {
  @ApiPropertyOptional({ example: 'Annual Leave' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultDaysPerYear?: number;
}

export class CreateHolidayDto {
  @ApiProperty({ example: 'Eid-ul-Fitr' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '2026-03-19' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({
    example: '2026-03-21',
    description: 'Omit for a single day holiday, which defaults to startDate.',
  })
  @IsOptional()
  @IsDateString()
  @IsNotBefore('startDate')
  endDate?: string;
}

export class UpdateHolidayDto {
  @ApiPropertyOptional({ example: 'Eid-ul-Fitr' })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SHORT_TEXT)
  name?: string;

  @ApiPropertyOptional({ example: '2026-03-19' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-03-21' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CreateLeaveRequestDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-08-12' })
  @IsDateString()
  @IsNotBefore('startDate')
  endDate!: string;

  @ApiPropertyOptional({ example: 'Family event' })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.LONG_TEXT)
  reason?: string;
}

export class RejectLeaveRequestDto {
  @ApiPropertyOptional({ example: 'Team is short-staffed that week' })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.LONG_TEXT)
  reason?: string;
}
