import { Module } from '@nestjs/common';
import { SlackModule } from '@/slack/slack.module';
import { BlockersController } from '@/blockers/blockers/blockers.controller';
import { ProjectBlockersController } from '@/blockers/blockers/project-blockers.controller';
import { BlockerService } from '@/blockers/blockers/blocker.service';
import { BlockerReasonsController } from '@/blockers/reasons/blocker-reasons.controller';
import { BlockerReasonsService } from '@/blockers/reasons/blocker-reasons.service';

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
