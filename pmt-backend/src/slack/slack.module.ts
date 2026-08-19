import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { SlackUserResolverService } from './slack-user-resolver.service';

@Module({
  providers: [SlackService, SlackUserResolverService],
  exports: [SlackService, SlackUserResolverService],
})
export class SlackModule {}
