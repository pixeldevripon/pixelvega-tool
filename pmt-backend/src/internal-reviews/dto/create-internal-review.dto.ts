import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InternalReviewDecision } from '@prisma/client';

const REVIEW_DECISIONS = [
  InternalReviewDecision.APPROVED,
  InternalReviewDecision.CHANGES_REQUIRED,
];

// Submitted by the Project Manager reviewing work in INTERNAL_REVIEW.
// comments is required when requesting changes, so the developer/designer
// has something actionable to fix. Enforced in InternalReviewsService, not
// here, since it depends on the decision value.
export class CreateInternalReviewDto {
  @ApiProperty({ enum: REVIEW_DECISIONS, example: 'APPROVED' })
  @IsIn(REVIEW_DECISIONS)
  decision!: InternalReviewDecision;

  @ApiPropertyOptional({
    example: 'The contact form is missing the honeypot field, please add it',
    description: 'Required when decision is CHANGES_REQUIRED.',
  })
  @IsOptional()
  @IsString()
  comments?: string;
}
