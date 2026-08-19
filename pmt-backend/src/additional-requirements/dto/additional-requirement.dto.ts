import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AdditionalRequirementStatus } from '@prisma/client';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { EnumDisplayDto } from '@/common/dto/display.dto';

const ADDITIONAL_REQUIREMENT_STATUSES = Object.values(
  AdditionalRequirementStatus,
);

const REVIEW_DECISIONS = [
  AdditionalRequirementStatus.APPROVED,
  AdditionalRequirementStatus.REJECTED,
];

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class RequirementUserDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'rezina@pixelvega.com' })
  email!: string;
}

export class AdditionalRequirementCapabilitiesDto {
  @ApiProperty({
    example: true,
    description:
      'Whether this caller may approve or reject it. False once it has been reviewed, since a decision is final.',
  })
  canReview!: boolean;
}

export class AdditionalRequirementResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({
    example:
      'Client asked (by phone) for a newsletter signup form on the homepage',
  })
  description!: string;

  @ApiPropertyOptional({
    example: 'phone call',
    nullable: true,
    description: 'Free text describing where the requirement came from.',
  })
  sourceChannel!: string | null;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiProperty({ type: RequirementUserDto })
  uploadedBy!: RequirementUserDto;

  @ApiPropertyOptional({ type: RequirementUserDto, nullable: true })
  reviewedBy!: RequirementUserDto | null;

  @ApiPropertyOptional({ example: '2026-08-13T09:00:00.000Z', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({
    example: false,
    description:
      'Whether a decision has been recorded. Convenience for the status value.',
  })
  isReviewed!: boolean;

  @ApiPropertyOptional({
    example: 8,
    nullable: true,
    description:
      "Hours added on top of the project's current estimate. Additive, never an absolute override, and only set when approved.",
  })
  approvedAdditionalHours!: number | null;

  @ApiPropertyOptional({
    example: 3,
    nullable: true,
    description: "Days added on top of the project's current deadline.",
  })
  deadlineExtensionDays!: number | null;

  @ApiProperty({
    example: false,
    description:
      "Whether approving this changed the project's estimate or deadline at all. An approval with neither is a real case: the work was accepted as absorbed.",
  })
  changedProjectPlan!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "The AI scope check for this requirement, when one has been run. Opaque to the API: its shape is the model's, not this contract's.",
  })
  aiScopeAnalysis!: unknown;

  @ApiProperty({ example: '2026-08-12T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-12T09:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: AdditionalRequirementCapabilitiesDto })
  capabilities!: AdditionalRequirementCapabilitiesDto;
}

export class PaginatedAdditionalRequirementsResponseDto {
  @ApiProperty({ type: [AdditionalRequirementResponseDto] })
  items!: AdditionalRequirementResponseDto[];

  @ApiProperty({ example: 5 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

export class QueryAdditionalRequirementsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ADDITIONAL_REQUIREMENT_STATUSES,
    description: 'Filter to a single status, e.g. PENDING_REVIEW.',
  })
  @IsOptional()
  @IsIn(ADDITIONAL_REQUIREMENT_STATUSES)
  status?: AdditionalRequirementStatus;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

// A requirement received outside the normal project scope (e.g. an email,
// an Upwork/Fiverr message, a client phone call), logged for a Project
// Manager to later approve or reject via ReviewAdditionalRequirementDto.
export class CreateAdditionalRequirementDto {
  @ApiProperty({
    example:
      'Client asked (by phone) for a newsletter signup form on the homepage',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    example: 'phone call',
    description:
      'Free text describing where this requirement came from, e.g. email, upwork, fiverr, phone call.',
  })
  @IsOptional()
  @IsString()
  sourceChannel?: string;
}

// approvedAdditionalHours/deadlineExtensionDays only apply when decision is
// APPROVED. Both are additive on top of the project's current
// estimatedHours/deadline, never absolute overrides.
export class ReviewAdditionalRequirementDto {
  @ApiProperty({
    enum: REVIEW_DECISIONS,
    example: AdditionalRequirementStatus.APPROVED,
  })
  @IsIn(REVIEW_DECISIONS)
  decision!: AdditionalRequirementStatus;

  @ApiPropertyOptional({
    example: 8,
    minimum: 0,
    description:
      "Added on top of the project's current estimatedHours. Only valid when decision is APPROVED.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedAdditionalHours?: number;

  @ApiPropertyOptional({
    example: 3,
    minimum: 1,
    description:
      "Days added on top of the project's current deadline. Only valid when decision is APPROVED.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  deadlineExtensionDays?: number;
}
