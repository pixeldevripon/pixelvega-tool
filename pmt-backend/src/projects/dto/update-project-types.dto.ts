import { ArrayMinSize, IsArray, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectType } from '@prisma/client';

const PROJECT_TYPES = Object.values(ProjectType);

export class UpdateProjectTypesDto {
  @ApiProperty({
    enum: PROJECT_TYPES,
    isArray: true,
    example: ['WEBFLOW', 'SEO'],
    description:
      'The full replacement set of project types — not a delta. Any type missing from this list is removed; any new one is added.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(PROJECT_TYPES, { each: true })
  projectTypes!: ProjectType[];
}
