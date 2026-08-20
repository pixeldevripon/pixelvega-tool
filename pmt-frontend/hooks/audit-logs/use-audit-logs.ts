'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { auditLogsApi } from '@/lib/api/audit-logs';
import type { AuditLogsQuery } from '@/types/audit-logs';

export const auditLogKeys = {
    all: ['audit-logs'] as const,
    lists: () => [...auditLogKeys.all, 'list'] as const,
    list: (query: AuditLogsQuery) => [...auditLogKeys.lists(), query] as const,
};

export function useAuditLogs(query: AuditLogsQuery) {
    return useQuery({
        queryKey: auditLogKeys.list(query),
        queryFn: () => auditLogsApi.list(query),
        placeholderData: keepPreviousData,
    });
}
