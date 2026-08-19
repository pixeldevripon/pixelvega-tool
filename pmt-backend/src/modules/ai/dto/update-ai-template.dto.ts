import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// kind is deliberately not editable: changing what a template is for is a
// new template, not an edit of an existing one.
export class UpdateAiTemplateDto {
  @ApiPropertyOptional({ example: 'Default project summary (revised)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: 'A structural outline, not the generated output itself.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @ApiPropertyOptional({
    description:
      'Setting this to true unsets any existing default of the same kind. Setting it to false just un-defaults this one, another can be set separately.',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
