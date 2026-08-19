import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BlockerSeverity, BlockerStatus } from '@prisma/client';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

// Lists blockers across every project (GET /blockers). projectId narrows to
// one project on top of status/severity. Use QueryProjectBlockersDto for the
// dashboard nested under a project, where projectId is already in the route.
export class QueryBlockersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BlockerStatus })
  @IsOptional()
  @IsEnum(BlockerStatus)
  status?: BlockerStatus;

  @ApiPropertyOptional({ enum: BlockerSeverity })
  @IsOptional()
  @IsEnum(BlockerSeverity)
  severity?: BlockerSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Filter to blockers assigned to this user.',
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}
