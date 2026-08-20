import type { AuditLogEntry, AuditLogsQuery } from '@/types/audit-logs';
import type { Paginated } from '@/types/api';

import { apiFetch } from './fetch';
import { buildQuery } from './query';

export const auditLogsApi = {
    list(query: AuditLogsQuery = {}): Promise<Paginated<AuditLogEntry>> {
        return apiFetch<Paginated<AuditLogEntry>>(
            `/audit-logs${buildQuery({
                page: query.page,
                pageSize: query.pageSize,
                action: query.action,
                userId: query.userId,
                targetType: query.targetType,
                targetId: query.targetId,
                startDate: query.startDate,
                endDate: query.endDate,
            })}`,
        );
    },
};
