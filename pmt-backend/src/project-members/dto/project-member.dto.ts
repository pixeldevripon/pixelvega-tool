import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ProjectRole } from '@prisma/client';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { EnumDisplayDto } from '@/common/dto/display.dto';

const PROJECT_ROLES = Object.values(ProjectRole);

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

/**
 * The staffed user, as a member row carries them.
 *
 * Mirrors `MEMBER_INCLUDE` in `project-members.service.ts`. Change them
 * together: the include is what the database returns and this is what the
 * contract promises, and nothing enforces that they agree except that they sit
 * one file apart and say so.
 */
export class ProjectMemberUserDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'rezina@pixelvega.com' })
  email!: string;

  @ApiProperty({
    type: EnumDisplayDto,
    description: "The user's global role, ready to render (ADR 0001).",
  })
  role!: EnumDisplayDto;
}

/**
 * What this caller may do to this membership (ADR 0002).
 *
 * Advisory. The service still enforces every rule, and a client that ignores
 * these gets a 403. They exist so the UI does not offer an action that fails.
 */
export class ProjectMemberCapabilitiesDto {
  @ApiProperty({
    example: true,
    description:
      'Whether this caller may remove this member from the project. False once the member has already left.',
  })
  canRemove!: boolean;

  @ApiProperty({
    example: true,
    description:
      "Whether this caller may retry the member's Slack channel invite. Requires the project to have a connected channel.",
  })
  canResyncSlack!: boolean;
}

export class ProjectMemberResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiProperty({
    type: EnumDisplayDto,
    description:
      'The staffing role, which narrows the global role to this project.',
  })
  role!: EnumDisplayDto;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  joinedAt!: Date;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Set when the member left. Null means currently staffed.',
  })
  leftAt!: Date | null;

  @ApiProperty({
    example: true,
    description:
      'Convenience for `leftAt === null`, so a client never has to reason about a timestamp to answer a yes or no question.',
  })
  isActive!: boolean;

  @ApiProperty({ type: ProjectMemberUserDto })
  user!: ProjectMemberUserDto;

  @ApiProperty({ type: ProjectMemberCapabilitiesDto })
  capabilities!: ProjectMemberCapabilitiesDto;
}

/**
 * `add()` returns the member plus, sometimes, a staffing warning.
 *
 * The warning is advisory and the add still succeeded: assigning someone to
 * more projects than the recommended maximum is a judgment call a manager is
 * allowed to make, so this reports it rather than refusing it.
 */
export class AddProjectMemberResponseDto extends ProjectMemberResponseDto {
  @ApiPropertyOptional({
    example:
      'Rezina Akter is now assigned to 6 active projects (recommended max: 5). They may be overloaded.',
    description:
      'Present only when the assignee is now over the recommended active project count. Safe to show a user verbatim.',
  })
  workloadWarning?: string;
}

export class PaginatedProjectMembersResponseDto {
  @ApiProperty({ type: [ProjectMemberResponseDto] })
  items!: ProjectMemberResponseDto[];

  @ApiProperty({ example: 4 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

/**
 * The outcome of retrying a Slack invite.
 *
 * `invited: false` is a normal answer, not an error: the member may simply not
 * have joined the Slack workspace yet. The endpoint therefore returns 200 with
 * this shape rather than throwing, and `message` is written to be shown to a
 * user verbatim.
 */
export class ResyncMemberSlackResponseDto {
  @ApiProperty({ example: true })
  invited!: boolean;

  @ApiProperty({
    example: "Rezina Akter was invited to the project's Slack channel.",
    description: 'Safe to show a user verbatim.',
  })
  message!: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

export class QueryProjectMembersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Include members who have left (leftAt set). Off by default, which returns only active members.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeLeft?: boolean = false;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

export class AddProjectMemberDto {
  // User.id is a string generated by better-auth, not guaranteed to be a
  // UUID, so @IsUUID() would reject every real user id.
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ enum: PROJECT_ROLES, example: ProjectRole.DEVELOPER })
  @IsIn(PROJECT_ROLES)
  role!: ProjectRole;
}
