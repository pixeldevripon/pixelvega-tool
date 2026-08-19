import { Module } from '@nestjs/common';
import { SlackModule } from '@/slack/slack.module';
import { BlockersController } from '@/projects/blockers/blockers.controller';
import { ProjectBlockersController } from '@/projects/blockers/project-blockers.controller';
import { BlockerService } from '@/projects/blockers/blocker.service';
import { BlockerReasonsController } from '@/projects/blockers/reasons/blocker-reasons.controller';
import { BlockerReasonsService } from '@/projects/blockers/reasons/blocker-reasons.service';

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
