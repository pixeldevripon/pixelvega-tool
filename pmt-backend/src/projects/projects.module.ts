import { Module } from '@nestjs/common';
import { SlackModule } from '@/slack/slack.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

/**
 * The core Project entity: CRUD, status, priority, types, archive and restore.
 *
 * Everything that hangs off a project (staffing, documents, time, work reports,
 * blockers, reviews, reporting) is its own module. They coexist without sharing
 * a module because ProjectActivityService is @Global.
 */
@Module({
  imports: [SlackModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
