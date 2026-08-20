import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Response DTOs ────────────────────────────────────────────────────────────

export class SessionCapabilitiesDto {
  @ApiProperty({
    example: true,
    description:
      "False for the session making the request. Signing yourself out from a list of devices is the sign-out button's job, not a row action, and a Revoke that logs you out of the page you are on reads as a bug.",
  })
  canRevoke!: boolean;
}

export class SessionResponseDto {
  @ApiProperty({ example: 'sess_3fa85f64' })
  id!: string;

  @ApiProperty({
    example: true,
    description: 'Whether this is the session the request arrived on.',
  })
  isCurrent!: boolean;

  @ApiPropertyOptional({
    example: 'Chrome on macOS',
    nullable: true,
    description:
      'Parsed from the user agent by the server, so two clients cannot disagree about what a user agent string means. Null when the header was absent.',
  })
  device!: string | null;

  @ApiPropertyOptional({
    example: '203.0.113.7',
    nullable: true,
    description:
      'The address the session was created from. Shown so someone can recognise a sign-in that was not theirs.',
  })
  ipAddress!: string | null;

  @ApiProperty({ example: '2026-08-19T14:32:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-19T14:32:00.000Z' })
  expiresAt!: Date;

  @ApiProperty({ type: SessionCapabilitiesDto })
  capabilities!: SessionCapabilitiesDto;
}

export class RevokedSessionsResponseDto {
  @ApiProperty({
    example: 3,
    description: 'How many sessions were destroyed.',
  })
  revoked!: number;

  @ApiProperty({ example: 'Signed out of 3 other devices.' })
  message!: string;
}
