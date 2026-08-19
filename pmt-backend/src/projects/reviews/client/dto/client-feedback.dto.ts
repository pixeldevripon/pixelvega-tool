import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ClientFeedbackDecision } from '@prisma/client';

import { EnumDisplayDto } from '@/common/dto/display.dto';
import * as FieldLength from '@/common/constants/field-lengths';
import { Trim } from '@/common/decorators/trim.decorator';

const FEEDBACK_DECISIONS = [
  ClientFeedbackDecision.APPROVED,
  ClientFeedbackDecision.CHANGES_REQUESTED,
];

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class ClientFeedbackUserDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  id!: string;

  @ApiProperty({ example: 'Acme Ltd' })
  name!: string;

  @ApiProperty({ example: 'ops@acme.com' })
  email!: string;
}

export class ClientFeedbackResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({ type: EnumDisplayDto })
  decision!: EnumDisplayDto;

  @ApiPropertyOptional({
    example: 'The header logo looks too small on mobile, please enlarge it',
    nullable: true,
    description: 'Always present when the decision is CHANGES_REQUESTED.',
  })
  comments!: string | null;

  @ApiProperty({ example: 1 })
  feedbackRound!: number;

  @ApiProperty({
    example: true,
    description:
      'Whether this was the first round, and therefore the one that moved the project.',
  })
  isFirstRound!: boolean;

  @ApiProperty({
    type: ClientFeedbackUserDto,
    description: 'The client whose verdict this is.',
  })
  client!: ClientFeedbackUserDto;

  @ApiPropertyOptional({
    type: ClientFeedbackUserDto,
    nullable: true,
    description:
      'Set when a project manager recorded feedback the client gave outside the system. Null when the client submitted it themselves.',
  })
  recordedBy!: ClientFeedbackUserDto | null;

  @ApiProperty({
    example: false,
    description:
      "Whether this was recorded on the client's behalf rather than submitted by them. Convenience for recordedBy being present.",
  })
  wasRecordedOnBehalf!: boolean;

  @ApiProperty({ example: '2026-08-12T09:00:00.000Z' })
  createdAt!: Date;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

// Submitted by the Client themselves, or by a Project Manager recording
// feedback the Client gave outside the system. comments is required when
// requesting changes, so there's something actionable to fix. Enforced in
// ClientFeedbackService, not here, since it depends on the decision value.
export class CreateClientFeedbackDto {
  @ApiProperty({
    enum: FEEDBACK_DECISIONS,
    example: ClientFeedbackDecision.APPROVED,
  })
  @IsIn(FEEDBACK_DECISIONS)
  decision!: ClientFeedbackDecision;

  @ApiPropertyOptional({
    example: 'The header logo looks too small on mobile, please enlarge it',
    description: 'Required when decision is CHANGES_REQUESTED.',
  })
  // Required by the trigger, and still type and length checked when
  // supplied anyway, which a bare trigger predicate would skip.
  @Trim()
  @ValidateIf(
    (o: Record<string, unknown>) =>
      o.decision === ClientFeedbackDecision.CHANGES_REQUESTED ||
      o.comments !== undefined,
  )
  @IsString()
  @MaxLength(FieldLength.LONG_TEXT)
  @IsNotEmpty({ message: 'comments are required when requesting changes' })
  comments?: string;
}
