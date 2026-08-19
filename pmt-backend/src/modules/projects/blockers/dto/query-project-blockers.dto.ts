import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BlockerSeverity, BlockerStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class QueryProjectBlockersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BlockerStatus })
  @IsOptional()
  @IsEnum(BlockerStatus)
  status?: BlockerStatus;

  @ApiPropertyOptional({ enum: BlockerSeverity })
  @IsOptional()
  @IsEnum(BlockerSeverity)
  severity?: BlockerSeverity;

  @ApiPropertyOptional({
    description: 'Filter to blockers assigned to this user.',
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}
