import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ProjectActivityType,
  ProjectPriority,
  ProjectStatus,
  ProjectType,
} from '@prisma/client';

/**
 * The response shapes for the Project entity.
 *
 * There are TWO, and the difference between them is a security boundary rather
 * than a convenience: `ClientProjectResponseDto` is what a CLIENT sees, and it
 * omits every internal field. Keeping it as a class means that contract is
 * stated in the type system and visible in `/api/docs`, instead of living only
 * in a hand written `select` object in the service.
 *
 * These mirror `PROJECT_INCLUDE` and `CLIENT_PROJECT_SELECT` in
 * projects.service.ts. Change them together.
 */

export class UserSummaryDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'pm@pixelvega.com' })
  email!: string;
}

export class ProjectTypeTagDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({ enum: ProjectType, example: ProjectType.WORDPRESS })
  type!: ProjectType;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;
}

/**
 * The full internal project. Everything on here beyond what
 * ClientProjectResponseDto carries is deliberately withheld from a CLIENT.
 */
export class ProjectResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme corporate site' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Five page marketing site plus a blog.',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.IN_PROGRESS })
  status!: ProjectStatus;

  @ApiProperty({
    enum: ProjectPriority,
    example: ProjectPriority.HIGH,
    description: 'Internal. Never returned to a CLIENT.',
  })
  priority!: ProjectPriority;

  @ApiPropertyOptional({
    example: 'Client launch event moved forward two weeks.',
    nullable: true,
    description:
      'Required when priority is URGENT or CRITICAL, cleared when it moves off them. Internal.',
  })
  rushReason!: string | null;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
  })
  clientId!: string | null;

  @ApiPropertyOptional({ type: UserSummaryDto, nullable: true })
  client!: UserSummaryDto | null;

  @ApiPropertyOptional({
    type: UserSummaryDto,
    nullable: true,
    description: 'Who created the project. Internal.',
  })
  createdBy!: UserSummaryDto | null;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z', nullable: true })
  plannedStartDate!: Date | null;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z', nullable: true })
  deadline!: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  completedAt!: Date | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Required when moving to ON_HOLD. Internal.',
  })
  onHoldReason!: string | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Required when cancelling. Internal.',
  })
  cancellationReason!: string | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description:
      'A flag layered on top of status, not part of the state machine.',
  })
  archivedAt!: Date | null;

  @ApiPropertyOptional({ example: 'C08ABCDEF', nullable: true })
  slackChannelId!: string | null;

  @ApiPropertyOptional({
    example: 120,
    nullable: true,
    description: 'Manually set.',
  })
  estimatedHours!: number | null;

  @ApiProperty({
    example: 47.5,
    description:
      'Recalculated from completed time segments every time one ends, on pause as well as on stop.',
  })
  actualHours!: number;

  @ApiPropertyOptional({
    example: 72.5,
    nullable: true,
    description:
      'Computed on the way out as estimated minus actual, never stored, so it cannot drift. Null when there is no estimate, which is a different fact from nothing remaining.',
  })
  remainingHours!: number | null;

  @ApiProperty({ type: [ProjectTypeTagDto] })
  projectTypeTags!: ProjectTypeTagDto[];

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-19T14:32:00.000Z' })
  updatedAt!: Date;
}

export class ClientProjectTypeTagDto {
  @ApiProperty({ enum: ProjectType, example: ProjectType.WORDPRESS })
  type!: ProjectType;
}

/**
 * What a CLIENT sees for their own project.
 *
 * The absences are the point. No priority, no rushReason, no onHoldReason, no
 * cancellationReason, no createdBy, no hours of any kind. A client is told
 * where their project is, not how the sausage is made.
 */
export class ClientProjectResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme corporate site' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Five page marketing site plus a blog.',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.IN_PROGRESS })
  status!: ProjectStatus;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z', nullable: true })
  plannedStartDate!: Date | null;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z', nullable: true })
  deadline!: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: [ClientProjectTypeTagDto] })
  projectTypeTags!: ClientProjectTypeTagDto[];

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;
}

export class PaginatedProjectsResponseDto {
  @ApiProperty({ type: [ProjectResponseDto] })
  items!: ProjectResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Present only for a DEVELOPER or DESIGNER: true once their active project count passes the recommended maximum. Advisory, never enforcing.',
  })
  overloaded?: boolean;
}

export class ProjectActivityResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({
    enum: ProjectActivityType,
    example: ProjectActivityType.STATUS_CHANGED,
  })
  type!: ProjectActivityType;

  @ApiPropertyOptional({
    example: 'Status changed from IN_PROGRESS to INTERNAL_REVIEW',
    nullable: true,
  })
  message!: string | null;

  @ApiPropertyOptional({
    example: { from: 'IN_PROGRESS', to: 'INTERNAL_REVIEW' },
    nullable: true,
  })
  metadata!: unknown;

  @ApiPropertyOptional({ type: UserSummaryDto, nullable: true })
  actor!: UserSummaryDto | null;

  @ApiProperty({ example: '2026-08-19T14:32:00.000Z' })
  createdAt!: Date;
}
