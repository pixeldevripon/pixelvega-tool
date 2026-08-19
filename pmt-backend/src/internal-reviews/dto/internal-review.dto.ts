import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { InternalReviewDecision } from '@prisma/client';

import { EnumDisplayDto } from '@/common/dto/display.dto';

const REVIEW_DECISIONS = [
  InternalReviewDecision.APPROVED,
  InternalReviewDecision.CHANGES_REQUIRED,
];

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class InternalReviewerDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'rezina@pixelvega.com' })
  email!: string;
}

export class InternalReviewResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({ type: EnumDisplayDto })
  decision!: EnumDisplayDto;

  @ApiPropertyOptional({
    example: 'The contact form is missing the honeypot field, please add it',
    nullable: true,
    description: 'Always present when the decision is CHANGES_REQUIRED.',
  })
  comments!: string | null;

  @ApiProperty({
    example: 1,
    description:
      'Which pass this was. Only the first round moves the project status, so a client showing history needs to know which one it is looking at.',
  })
  reviewRound!: number;

  @ApiProperty({
    example: true,
    description:
      'Whether this was the first round, and therefore the one that moved the project.',
  })
  isFirstRound!: boolean;

  @ApiProperty({ type: InternalReviewerDto })
  reviewedBy!: InternalReviewerDto;

  @ApiProperty({ example: '2026-08-12T09:00:00.000Z' })
  createdAt!: Date;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

// Submitted by the Project Manager reviewing work in INTERNAL_REVIEW.
// comments is required when requesting changes, so the developer/designer
// has something actionable to fix. Enforced in InternalReviewsService, not
// here, since it depends on the decision value.
export class CreateInternalReviewDto {
  @ApiProperty({
    enum: REVIEW_DECISIONS,
    example: InternalReviewDecision.APPROVED,
  })
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
