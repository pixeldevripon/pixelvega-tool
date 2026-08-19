import { Module } from '@nestjs/common';
import { SlackModule } from '@/slack/slack.module';
import { BlockersController } from './blockers.controller';
import { ProjectBlockersController } from './project-blockers.controller';
import { BlockerService } from './blocker.service';
import { BlockerReasonsController } from './blocker-reasons.controller';
import { BlockerReasonsService } from './blocker-reasons.service';

/** Real time blockers, plus the PM managed reasons they are categorised by. */
@Module({
  imports: [SlackModule],
  controllers: [
    BlockersController,
    ProjectBlockersController,
    BlockerReasonsController,
  ],
  providers: [BlockerService, BlockerReasonsService],
  exports: [BlockerService],
})
export class BlockersModule {}
