import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AiJobStatus, AiJobType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ScopeCheckService } from '@/ai/scope-check/scope-check.service';
import { StatusReportService } from '@/ai/status-report/status-report.service';

interface AiJobData {
  aiJobId: string;
}

// One shared processor for the whole queue, dispatching on job.name into
// the real per type handler, rather than each feature registering its own
// competing @Processor('ai-jobs') class, BullMQ expects one worker per
// queue name, not one per job type.
@Processor('ai-jobs')
export class AiJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(AiJobsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeCheckService: ScopeCheckService,
    private readonly statusReportService: StatusReportService,
  ) {
    super();
  }

  async process(job: Job<AiJobData>): Promise<void> {
    const { aiJobId } = job.data;

    await this.prisma.aiJob.update({
      where: { id: aiJobId },
      data: { status: AiJobStatus.PROCESSING, startedAt: new Date() },
    });

    try {
      if (job.name === AiJobType.CHECK_SCOPE) {
        await this.scopeCheckService.handle(job);
      } else if (job.name === AiJobType.GENERATE_STATUS_REPORT) {
        await this.statusReportService.handle(job);
      }
      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: { status: AiJobStatus.COMPLETED, finishedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`AiJob ${aiJobId} failed`, error);
      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: {
          status: AiJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }
}
