import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectSlackChannelDto {
  @ApiPropertyOptional({
    example: 'C0BKUALB5F1',
    description:
      "The id of an existing Slack channel to link to this project, for the case where one was already created by hand. Omit to have the system create a brand-new private channel instead. Either way, the project's current active members and all admins are invited into it.",
  })
  @IsOptional()
  @IsString()
  slackChannelId?: string;
}
