import { Module } from '@nestjs/common';
import { SlackModule } from '@/slack/slack.module';
import { ProjectMembersController } from './project-members.controller';
import { ProjectMembersService } from './project-members.service';

/** Who is staffed on a project, as append only history. */
@Module({
  imports: [SlackModule],
  controllers: [ProjectMembersController],
  providers: [ProjectMembersService],
  exports: [ProjectMembersService],
})
export class ProjectStaffingModule {}
