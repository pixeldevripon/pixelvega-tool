import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { endOfUtcDay, startOfUtcDay } from '@/common/utils/date.util';
import { paginate } from '@/common/utils/pagination.util';
import { toAuditLogResponse } from './audit-log.mapper';
import { QueryAuditLogDto } from '@/audit-logs/dto/audit-log.dto';

export interface LogEntry {
  userId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}

// This is cross cutting infra, like PrismaService: any module can inject
// this without importing AuditLogModule, since it's @Global().
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: LogEntry) {
    return this.prisma.auditLog.create({ data: entry });
  }

  async findAll(query: QueryAuditLogDto) {
    const {
      targetType,
      targetId,
      userId,
      action,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = query;

    const where = {
      ...(targetType && { targetType }),
      ...(targetId && { targetId }),
      ...(userId && { userId }),
      ...(action && { action }),
      // One clause, so a range with both ends does not overwrite one of them.
      // `endDate` reaches the END of the day it names: a reader asking for
      // "the 31st" means the whole of it, and a naive `lte` on midnight would
      // silently drop everything that happened during it.
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: startOfUtcDay(startDate) }),
          ...(endDate && { lte: endOfUtcDay(endDate) }),
        },
      }),
    };

    const result = await paginate(
      (args) =>
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, email: true } } },
          ...args,
        }),
      () => this.prisma.auditLog.count({ where }),
      page,
      pageSize,
    );

    return { ...result, items: result.items.map(toAuditLogResponse) };
  }
}
