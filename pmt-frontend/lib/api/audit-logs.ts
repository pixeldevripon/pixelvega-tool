import { apiRequest } from "@/lib/api/client";

export type AuditLogUser = {
  id: string;
  name: string;
  email: string;
};

export type AuditLogMetadata =
  | string
  | number
  | boolean
  | null
  | AuditLogMetadata[]
  | { [key: string]: AuditLogMetadata };

export type AuditLogEntry = {
  id: string;
  userId?: string | null;
  user?: AuditLogUser | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: AuditLogMetadata;
  createdAt: string;
};

export type AuditLogQuery = {
  page?: number;
  pageSize?: number;
  userId?: string;
  targetType?: string;
  targetId?: string;
};

export type PaginatedAuditLogs = {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
};

function buildQueryString(query: AuditLogQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

export const auditLogsApi = {
  list(query: AuditLogQuery = {}) {
    const queryString = buildQueryString({ pageSize: 20, ...query });
    return apiRequest<PaginatedAuditLogs>(
      `/api/audit-logs${queryString ? `?${queryString}` : ""}`,
    );
  },
};
