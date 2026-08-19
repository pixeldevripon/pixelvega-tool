import { Injectable } from '@nestjs/common';
import type { Prisma, ProjectActivityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Shared by every module that touches a Project (staffing, documents, time
// tracking, standups, ...) so they all write to the same immutable timeline
// instead of each duplicating this Prisma call.
@Injectable()
export class ProjectActivityService {
  constructor(private readonly prisma: PrismaService) {}

  log(
    projectId: string,
    userId: string | undefined,
    type: ProjectActivityType,
    options?: { message?: string; metadata?: Prisma.InputJsonValue },
  ) {
    return this.prisma.projectActivity.create({
      data: {
        projectId,
        userId,
        type,
        message: options?.message,
        metadata: options?.metadata,
      },
    });
  }
}
