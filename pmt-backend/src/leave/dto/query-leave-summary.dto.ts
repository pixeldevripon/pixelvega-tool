import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

const LEAVE_TAKING_ROLES = [
  Role.PROJECT_MANAGER,
  Role.DEVELOPER,
  Role.DESIGNER,
];

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
    example: ['DEVELOPER', 'DESIGNER'],
    description:
      'Comma separated (?role=DEVELOPER,DESIGNER) or repeated (?role=DEVELOPER&role=DESIGNER). Matches ANY of the given roles, not all of them. Only PROJECT_MANAGER, DEVELOPER, and DESIGNER can have leave requests.',
  })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((v) => v.trim());
    return value;
  })
  @IsArray()
  @IsIn(LEAVE_TAKING_ROLES, { each: true })
  role?: Role[];

  @ApiPropertyOptional({
    description: 'Narrow the report to one specific user',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Adds a requests array under each user with the exact startDate, endDate, leaveType, and reason for every leave request behind their totals, oldest first.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDetails?: boolean = false;
}
