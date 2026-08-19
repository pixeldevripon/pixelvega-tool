import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotBefore } from '@/common/validators/is-not-before.validator';
import { IsDateString } from 'class-validator';

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

/**
 * What the summary was built from.
 *
 * Returned so a reader can judge the summary rather than take it on faith: a
 * summary drawn from two wrap ups and no PRD deserves less weight than one
 * drawn from thirty and a full spec.
 */
export class AiSummaryBasisDto {
  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
    description: 'The PRD the summary had available, if the project has one.',
  })
  prdDocumentId!: string | null;

  @ApiProperty({
    example: 24,
    description: 'How many wrap up entries fed the summary.',
  })
  wrapUpEntryCount!: number;

  @ApiProperty({
    example: { startDate: '2026-08-01', endDate: '2026-08-31' },
    description: 'The window the entries were drawn from.',
  })
  dateRange!: { startDate: string; endDate: string };
}

export class ProjectAiSummaryResponseDto {
  @ApiProperty({
    example: 'The team completed the auth module and began the checkout flow.',
    description: 'Markdown.',
  })
  summary!: string;

  @ApiProperty({ example: '2026-08-31T09:00:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ type: AiSummaryBasisDto })
  basedOn!: AiSummaryBasisDto;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

export class QueryProjectAiSummaryDto {
  @ApiProperty({
    example: '2026-08-01',
    description:
      'Start of the window to pull reported accomplishments from (inclusive).',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    example: '2026-08-31',
    description:
      'End of the window to pull reported accomplishments from (inclusive).',
  })
  @IsDateString()
  @IsNotBefore('startDate')
  endDate!: string;
}
