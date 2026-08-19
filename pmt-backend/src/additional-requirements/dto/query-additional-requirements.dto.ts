import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdditionalRequirementStatus } from '@prisma/client';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

const ADDITIONAL_REQUIREMENT_STATUSES = Object.values(
  AdditionalRequirementStatus,
);

export class QueryAdditionalRequirementsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ADDITIONAL_REQUIREMENT_STATUSES,
    description: 'Filter to a single status, e.g. PENDING_REVIEW.',
  })
  @IsOptional()
  @IsIn(ADDITIONAL_REQUIREMENT_STATUSES)
  status?: AdditionalRequirementStatus;
}
