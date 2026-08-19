import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AvailabilityStatus, EmployeeWorkStatus } from '@prisma/client';

const WORK_STATUSES = Object.values(EmployeeWorkStatus);
const AVAILABILITY_STATUSES = Object.values(AvailabilityStatus);

// Superset of EmployeeProfile and ClientProfile fields. ProfilesService
// picks the subset relevant to the caller's role and ignores the rest.
// avatarUrl is not here. It's managed via POST /profiles/me/avatar instead.
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jabed Hasan' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Employee only' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ description: 'Employee or Client' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Employee or Client' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Employee only' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ enum: WORK_STATUSES, description: 'Employee only' })
  @IsOptional()
  @IsIn(WORK_STATUSES)
  currentStatus?: EmployeeWorkStatus;

  @ApiPropertyOptional({
    enum: AVAILABILITY_STATUSES,
    description: 'Employee only',
  })
  @IsOptional()
  @IsIn(AVAILABILITY_STATUSES)
  availabilityStatus?: AvailabilityStatus;

  @ApiPropertyOptional({ description: 'Client only' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: 'Client only' })
  @IsOptional()
  @IsEmail()
  billingEmail?: string;
}
