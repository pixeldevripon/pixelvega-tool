import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientFeedbackDecision } from '@prisma/client';

const FEEDBACK_DECISIONS = [
  ClientFeedbackDecision.APPROVED,
  ClientFeedbackDecision.CHANGES_REQUESTED,
];

// Submitted by the Client themselves, or by a Project Manager recording
// feedback the Client gave outside the system. comments is required when
// requesting changes, so there's something actionable to fix. Enforced in
// ClientFeedbackService, not here, since it depends on the decision value.
export class CreateClientFeedbackDto {
  @ApiProperty({ enum: FEEDBACK_DECISIONS, example: 'APPROVED' })
  @IsIn(FEEDBACK_DECISIONS)
  decision!: ClientFeedbackDecision;

  @ApiPropertyOptional({
    example: 'The header logo looks too small on mobile, please enlarge it',
    description: 'Required when decision is CHANGES_REQUESTED.',
  })
  @IsOptional()
  @IsString()
  comments?: string;
}
