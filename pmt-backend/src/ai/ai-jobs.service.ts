import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AiJob, AiJobType, Prisma, ProjectRole, Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { toAiJobResponse } from '@/ai/ai.mapper';
import { AiJobResponseDto } from '@/ai/dto/ai.dto';

export interface EnqueueAiJobOptions {
  projectId?: string;
  requestedById?: string;
  input?: Prisma.InputJsonValue;
}

// The AiJob row is the thing a client polls (GET /ai-jobs/:id), bullmq's own
// job object is not exposed outside the backend. Shared across both async
// features (CHECK_SCOPE, GENERATE_STATUS_REPORT), not duplicated per
// feature, since enqueue/lookup/access-check logic is identical for both.
@Injectable()
export class AiJobsService {
  private readonly logger = new Logger(AiJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('ai-jobs') private readonly queue: Queue,
  ) {}

  async enqueue(type: AiJobType, options: EnqueueAiJobOptions): Promise<AiJob> {
    const job = await this.prisma.aiJob.create({
      data: {
        type,
        projectId: options.projectId,
        requestedById: options.requestedById,
        input: options.input ?? {},
      },
    });
    await this.queue.add(type, { aiJobId: job.id });
    this.logger.log(`Queued ${type} job ${job.id}`);
    return job;
  }

  async findOneScoped(
    id: string,
    actorId: string,
    actorRole: Role,
  ): Promise<AiJobResponseDto> {
    const job = await this.prisma.aiJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    await this.assertCanView(job, actorId, actorRole);
    return toAiJobResponse(job);
  }

  // Both real job types today (CHECK_SCOPE, GENERATE_STATUS_REPORT) require
  // the same access as the endpoint that enqueued them: a Project Manager
  // staffed on that specific project, plus the automatic Admin/System
  // Admin. If a projectless job type is ever added, this fails closed
  // rather than silently letting anyone read it.
  private async assertCanView(job: AiJob, actorId: string, actorRole: Role) {
    if (actorRole === Role.ADMIN || actorRole === Role.SYSTEM_ADMIN) {
      return;
    }
    if (!job.projectId) {
      throw new ForbiddenException('You cannot view this job');
    }
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId: job.projectId,
        userId: actorId,
        role: ProjectRole.PROJECT_MANAGER,
        leftAt: null,
      },
    });
    if (!membership) {
      throw new ForbiddenException('You do not manage this project');
    }
  }
}
