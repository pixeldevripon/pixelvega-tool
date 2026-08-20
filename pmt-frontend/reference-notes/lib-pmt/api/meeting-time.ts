import { apiRequest } from "@/lib/api/client";
import type { TimeEntryStatus } from "@/lib/api/projects";

export type MeetingTimeEntry = {
  id: string;
  userId: string;
  sessionId: string;
  status: TimeEntryStatus;
  notes?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationMinutes?: number | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name?: string | null; email?: string | null } | null;
};

export type ActiveProjectTimer = {
  id: string;
  projectId: string;
  status: "RUNNING";
  startedAt: string;
  project?: { id: string; name: string } | null;
};

export type ActiveTimerResponse = {
  active: boolean;
  kind: "PROJECT" | "MEETING" | null;
  entry: MeetingTimeEntry | ActiveProjectTimer | null;
};

export type MeetingEntriesQuery = {
  page?: number;
  pageSize?: number;
  userId?: string;
  status?: TimeEntryStatus;
  startDate?: string;
  endDate?: string;
};

export type MeetingEntriesResponse = {
  items: MeetingTimeEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalMinutes: number;
  totalHours: number;
};

type MeetingTimerInput = { notes?: string };

function buildQuery(query?: MeetingEntriesQuery) {
  if (!query) return "";
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.userId) params.set("userId", query.userId);
  if (query.status) params.set("status", query.status);
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  const value = params.toString();
  return value ? `?${value}` : "";
}

export const meetingTimeApi = {
  async active() {
    return apiRequest<ActiveTimerResponse>("/api/time-entries/active");
  },

  async list(query?: MeetingEntriesQuery) {
    return apiRequest<MeetingEntriesResponse>(
      `/api/time-entries/meetings${buildQuery(query)}`,
    );
  },

  async start(input: MeetingTimerInput = {}) {
    return apiRequest<MeetingTimeEntry>("/api/time-entries/meetings/start", {
      method: "POST",
      body: input,
    });
  },

  async pause(entryId: string, input: MeetingTimerInput = {}) {
    return apiRequest<MeetingTimeEntry>(
      `/api/time-entries/meetings/${entryId}/pause`,
      { method: "PATCH", body: input },
    );
  },

  async resume(entryId: string, input: MeetingTimerInput = {}) {
    return apiRequest<MeetingTimeEntry>(
      `/api/time-entries/meetings/${entryId}/resume`,
      { method: "PATCH", body: input },
    );
  },

  async stop(entryId: string, input: MeetingTimerInput = {}) {
    return apiRequest<MeetingTimeEntry>(
      `/api/time-entries/meetings/${entryId}/stop`,
      { method: "PATCH", body: input },
    );
  },
};
