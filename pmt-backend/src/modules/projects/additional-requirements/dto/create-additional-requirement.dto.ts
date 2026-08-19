import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// A requirement received outside the normal project scope (e.g. an email,
// an Upwork/Fiverr message, a client phone call), logged for a Project
// Manager to later approve or reject via ReviewAdditionalRequirementDto.
export class CreateAdditionalRequirementDto {
  @ApiProperty({
    example:
      'Client asked (by phone) for a newsletter signup form on the homepage',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    example: 'phone call',
    description:
      'Free text describing where this requirement came from, e.g. email, upwork, fiverr, phone call.',
  })
  @IsOptional()
  @IsString()
  sourceChannel?: string;
}
