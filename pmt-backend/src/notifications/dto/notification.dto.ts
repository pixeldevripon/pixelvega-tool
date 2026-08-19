import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

// ── Response DTOs ────────────────────────────────────────────────────────────

/**
 * One row per RECIPIENT, not one shared row several people read. The same event
 * fans out into a separate Notification per person, because a notification is
 * inherently personal, unlike a ProjectActivity row.
 */
export class NotificationResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  userId!: string;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.LEAVE_REQUEST_APPROVED,
  })
  type!: NotificationType;

  @ApiProperty({ example: 'Your leave request was approved' })
  title!: string;

  @ApiPropertyOptional({
    example: 'Team is short staffed that week',
    nullable: true,
  })
  message!: string | null;

  @ApiPropertyOptional({
    example: { leaveRequestId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
    nullable: true,
    description:
      'Ids the client can use to deep link to whatever the notification is about.',
  })
  metadata!: unknown;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Null until the recipient reads it.',
  })
  readAt!: Date | null;

  @ApiProperty({ example: '2026-08-19T14:32:00.000Z' })
  createdAt!: Date;
}

export class PaginatedNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

export class UnreadCountResponseDto {
  @ApiProperty({ example: 7 })
  count!: number;
}

export class MarkAllReadResponseDto {
  @ApiProperty({ example: 7, description: 'How many rows were updated.' })
  count!: number;
}

// ── Query DTOs ───────────────────────────────────────────────────────────────

export class QueryNotificationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Only return unread notifications (readAt is null).',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}
