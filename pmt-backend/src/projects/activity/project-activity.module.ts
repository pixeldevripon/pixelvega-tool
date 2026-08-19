import { Global, Module } from '@nestjs/common';
import { ProjectActivityService } from './project-activity.service';

/**
 * @Global(), for the same reason PrismaModule and AuditLogModule are.
 *
 * ProjectActivity is one append only log across the whole project domain, and
 * eight modules write to it: projects, staffing, documents, time tracking, work
 * reports, blockers, reviews and requirements. Registering the service in each
 * of them would give each its own DI instance, which is exactly what kept all
 * seventeen controllers in one ProjectsModule until now. Making it global is
 * what lets that module be split without splitting the log.
 */
@Global()
@Module({
  providers: [ProjectActivityService],
  exports: [ProjectActivityService],
})
export class ProjectActivityModule {}
