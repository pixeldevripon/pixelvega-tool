import { IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdditionalRequirementStatus } from '@prisma/client';

const REVIEW_DECISIONS = [
  AdditionalRequirementStatus.APPROVED,
  AdditionalRequirementStatus.REJECTED,
];

// approvedAdditionalHours/deadlineExtensionDays only apply when decision is
// APPROVED. Both are additive on top of the project's current
// estimatedHours/deadline, never absolute overrides.
export class ReviewAdditionalRequirementDto {
  @ApiProperty({ enum: REVIEW_DECISIONS, example: 'APPROVED' })
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
