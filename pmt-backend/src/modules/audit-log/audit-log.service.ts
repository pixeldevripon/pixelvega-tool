import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/utils/pagination.util';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

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
    const { targetType, targetId, userId, page = 1, pageSize = 20 } = query;
    const where = {
      ...(targetType && { targetType }),
      ...(targetId && { targetId }),
      ...(userId && { userId }),
    };

    return paginate(
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
  }
}
