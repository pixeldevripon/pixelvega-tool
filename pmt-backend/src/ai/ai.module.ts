// The BullModule.forRoot() call below reads process.env.REDIS_URL inside the
// @Module() decorator's arguments, which is evaluated at module load time
// (import time), not deferred to a constructor. This file needs its own
// dotenv/config import for the same reason auth.instance.ts and
// cloudinary.service.ts do, see CLAUDE.md's "module load order trap" note.
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { ClaudeService } from '@/ai/claude/claude.service';
import { AiJobsService } from '@/ai/jobs/ai-jobs.service';
import { AiJobsProcessor } from '@/ai/jobs/ai-jobs.processor';
import { AiJobsController } from '@/ai/jobs/ai-jobs.controller';
import { AiTemplatesService } from '@/ai/templates/ai-templates.service';
import { AiTemplatesController } from '@/ai/templates/ai-templates.controller';
import { ScopeCheckService } from '@/ai/scope-check/scope-check.service';
import { StatusReportService } from '@/ai/status-reports/status-report.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: new Redis(process.env.REDIS_URL ?? '', {
        // Required by BullMQ's own workers/queues, not optional.
        maxRetriesPerRequest: null,
        // Defers the actual connection attempt until the first command, so
        // an unreachable Redis fails the first job rather than blocking
        // this whole app's boot.
        lazyConnect: true,
      }),
    }),
    BullModule.registerQueue({ name: 'ai-jobs' }),
  ],
  controllers: [AiJobsController, AiTemplatesController],
  providers: [
    ClaudeService,
    AiJobsService,
    AiJobsProcessor,
    AiTemplatesService,
    ScopeCheckService,
    StatusReportService,
  ],
  exports: [ClaudeService, AiJobsService, AiTemplatesService],
})
export class AiModule {}
