import { apiRequest } from "@/lib/api/client";
import type { AppUser } from "@/types/auth";

export type ProjectStatus =
  | "PLANNING"
  | "SCHEDULED"
  | "READY_FOR_WORK"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "INTERNAL_REVIEW"
  | "READY_FOR_CLIENT"
  | "WAITING_FOR_FEEDBACK"
  | "COMPLETED"
  | "CANCELLED";

export type ProjectPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "CRITICAL";

export type ProjectType =
  | "WORDPRESS"
  | "WEBFLOW"
  | "WIX"
  | "FRAMER"
  | "FIGMA"
  | "MERN_STACK"
  | "SEO";

export type ProjectRole = "PROJECT_MANAGER" | "DEVELOPER" | "DESIGNER";

export type ProjectDocumentType =
  | "PRD"
  | "REQUIREMENT"
  | "MEETING_NOTE"
  | "CREDENTIAL"
  | "ASSET"
  | "DELIVERABLE";

export type ProjectDocumentFormat = "TEXT" | "FILE";

export type ProjectTypeTag = {
  id?: string;
  projectId?: string;
  type: ProjectType;
  createdAt?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  priority?: ProjectPriority;
  rushReason?: string | null;
  clientId?: string | null;
  client?: Pick<AppUser, "id" | "name" | "email" | "role"> | null;
  createdById?: string | null;
  createdBy?: Pick<AppUser, "id" | "name" | "email" | "role"> | null;
  plannedStartDate?: string | null;
  deadline?: string | null;
  completedAt?: string | null;
  onHoldReason?: string | null;
  cancellationReason?: string | null;
  archivedAt?: string | null;
  slackChannelId?: string | null;
  estimatedHours?: number | null;
  actualHours?: number;
  remainingHours?: number | null;
  projectTypeTags?: ProjectTypeTag[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  leftAt?: string | null;
  user?: Pick<AppUser, "id" | "name" | "email" | "role"> | null;
};

export type ProjectActivity = {
  id: string;
  projectId: string;
  userId?: string | null;
  type: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user?: Pick<AppUser, "id" | "name" | "email"> | null;
};

export type ProjectDocument = {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  type: ProjectDocumentType;
  format: ProjectDocumentFormat;
  fileUrl?: string | null;
  fileMimeType?: string | null;
  fileSizeBytes?: number | null;
  textContent?: string | null;
  uploadedById: string;
  uploadedBy?: Pick<AppUser, "id" | "name" | "email"> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type TimeEntryStatus = "RUNNING" | "PAUSED" | "STOPPED";

export type TimeEntry = {
  id: string;
  projectId: string;
  userId: string;
  sessionId: string;
  status: TimeEntryStatus;
  notes?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationMinutes?: number | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<AppUser, "id" | "name" | "email"> | null;
  project?: Pick<Project, "id" | "name"> | null;
};

export type TimeEntriesResponse = PaginatedProjectResponse<TimeEntry> & {
  totalMinutes: number;
  totalHours: number;
};

export type DailyTimeSummaryDay = {
  date: string;
  totalMinutes: number;
  totalHours: number;
};

export type ProjectDailyTimeSummary = {
  projectId: string;
  userId: string | null;
  days: DailyTimeSummaryDay[];
  totalMinutes: number;
  totalHours: number;
};

export type ProjectTimeSummaryItem = {
  projectId: string;
  projectName: string | null;
  totalMinutes: number;
  totalHours: number;
};

export type ProjectTimeSummary = {
  userId: string;
  projects: ProjectTimeSummaryItem[];
  totalMinutes: number;
  totalHours: number;
};

export type ActiveTimeEntryResponse = {
  active: boolean;
  entry: TimeEntry | null;
};

export type PaginatedProjectResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  overloaded?: boolean;
};

export type ProjectListResponse = PaginatedProjectResponse<Project>;

export type ProjectQuery = {
  page?: number;
  pageSize?: number;
  status?: ProjectStatus | "ALL";
  priority?: ProjectPriority | "ALL";
  clientId?: string | "ALL";
  projectTypes?: ProjectType[];
  archived?: boolean;
  search?: string;
};

export type ProjectMembersQuery = {
  page?: number;
  pageSize?: number;
  includeLeft?: boolean;
};

export type ProjectDocumentsQuery = {
  page?: number;
  pageSize?: number;
  type?: ProjectDocumentType | "ALL";
};

export type TimeEntriesQuery = {
  page?: number;
  pageSize?: number;
  userId?: string | "ALL";
  status?: TimeEntryStatus | "ALL";
  startDate?: string;
  endDate?: string;
};

export type ProjectSummaryQuery = {
  userId?: string;
  startDate?: string;
  endDate?: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  clientId: string;
  projectTypes: ProjectType[];
  plannedStartDate?: string;
  deadline?: string;
};

export type AddProjectMemberInput = {
  userId: string;
  role: ProjectRole;
};

export type AddProjectMemberResponse = ProjectMember & {
  workloadWarning?: string;
};

export type ResyncSlackInviteResponse = {
  invited: boolean;
  message: string;
};

export type UpdateProjectStatusInput = {
  status: ProjectStatus;
  reason?: string;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string;
  plannedStartDate?: string;
  deadline?: string;
};

export type UpdateProjectTypesInput = {
  projectTypes: ProjectType[];
};

export type UpdateProjectPriorityInput = {
  priority: ProjectPriority;
  rushReason?: string;
};

export type CreateProjectDocumentInput = {
  title: string;
  type: ProjectDocumentType;
  description?: string;
  textContent?: string;
  file?: File | null;
};

export type UpdateProjectDocumentInput = {
  title?: string;
  description?: string;
  textContent?: string;
};

export type TimeEntryNoteInput = {
  notes?: string;
};

export type UpdateEstimatedHoursInput = {
  estimatedHours: number;
};

export type ConnectSlackChannelInput = {
  slackChannelId?: string;
};

function buildProjectQuery(query: ProjectQuery = {}) {
  const params = new URLSearchParams();

  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status && query.status !== "ALL") params.set("status", query.status);
  if (query.priority && query.priority !== "ALL") {
    params.set("priority", query.priority);
  }
  if (query.clientId && query.clientId !== "ALL") {
    params.set("clientId", query.clientId);
  }
  if (query.projectTypes?.length) {
    params.set("projectTypes", query.projectTypes.join(","));
  }
  if (query.archived !== undefined) params.set("archived", String(query.archived));
  if (query.search?.trim()) params.set("search", query.search.trim());

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function buildProjectMembersQuery(query: ProjectMembersQuery = {}) {
  const params = new URLSearchParams();

  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.includeLeft !== undefined) {
    params.set("includeLeft", String(query.includeLeft));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function buildProjectDocumentsQuery(query: ProjectDocumentsQuery = {}) {
  const params = new URLSearchParams();

  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.type && query.type !== "ALL") params.set("type", query.type);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function buildTimeEntriesQuery(query: TimeEntriesQuery = {}) {
  const params = new URLSearchParams();

  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.userId && query.userId !== "ALL") params.set("userId", query.userId);
  if (query.status && query.status !== "ALL") params.set("status", query.status);
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function buildProjectSummaryQuery(query: ProjectSummaryQuery = {}) {
  const params = new URLSearchParams();

  if (query.userId) params.set("userId", query.userId);
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export const projectStatuses: ProjectStatus[] = [
  "PLANNING",
  "SCHEDULED",
  "READY_FOR_WORK",
  "IN_PROGRESS",
  "ON_HOLD",
  "INTERNAL_REVIEW",
  "READY_FOR_CLIENT",
  "WAITING_FOR_FEEDBACK",
  "COMPLETED",
  "CANCELLED",
];

export const projectPriorities: ProjectPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
  "CRITICAL",
];

export const projectTypes: ProjectType[] = [
  "WORDPRESS",
  "WEBFLOW",
  "WIX",
  "FRAMER",
  "FIGMA",
  "MERN_STACK",
  "SEO",
];

export const projectDocumentTypes: ProjectDocumentType[] = [
  "PRD",
  "REQUIREMENT",
  "MEETING_NOTE",
  "CREDENTIAL",
  "ASSET",
  "DELIVERABLE",
];

export const projectsApi = {
  async list(query?: ProjectQuery) {
    return apiRequest<ProjectListResponse>(`/api/projects${buildProjectQuery(query)}`);
  },

  async listMine(query?: Pick<ProjectQuery, "page" | "pageSize" | "archived">) {
    return apiRequest<ProjectListResponse>(
      `/api/projects/mine${buildProjectQuery(query)}`,
    );
  },

  async findForUser(
    userId: string,
    query?: Pick<ProjectQuery, "page" | "pageSize" | "archived">,
  ) {
    return apiRequest<ProjectListResponse>(
      `/api/projects/users/${userId}${buildProjectQuery(query)}`,
    );
  },

  async findOne(projectId: string) {
    return apiRequest<Project>(`/api/projects/${projectId}`);
  },

  async activities(projectId: string, query?: Pick<ProjectQuery, "page" | "pageSize">) {
    return apiRequest<PaginatedProjectResponse<ProjectActivity>>(
      `/api/projects/${projectId}/activities${buildProjectQuery(query)}`,
    );
  },

  async members(projectId: string, query?: ProjectMembersQuery) {
    return apiRequest<{
      items: ProjectMember[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/api/projects/${projectId}/members${buildProjectMembersQuery(query)}`);
  },

  async addMember(projectId: string, input: AddProjectMemberInput) {
    return apiRequest<AddProjectMemberResponse>(
      `/api/projects/${projectId}/members`,
      {
        method: "POST",
        body: input,
      },
    );
  },

  async removeMember(projectId: string, memberId: string) {
    return apiRequest<ProjectMember>(
      `/api/projects/${projectId}/members/${memberId}`,
      { method: "DELETE" },
    );
  },

  async resyncSlackInvite(projectId: string, memberId: string) {
    return apiRequest<ResyncSlackInviteResponse>(
      `/api/projects/${projectId}/members/${memberId}/resync-slack`,
      { method: "POST" },
    );
  },

  async documents(projectId: string, query?: ProjectDocumentsQuery) {
    return apiRequest<PaginatedProjectResponse<ProjectDocument>>(
      `/api/projects/${projectId}/documents${buildProjectDocumentsQuery(query)}`,
    );
  },

  async createDocument(projectId: string, input: CreateProjectDocumentInput) {
    const formData = new FormData();
    formData.set("title", input.title);
    formData.set("type", input.type);
    if (input.description) formData.set("description", input.description);
    if (input.textContent) formData.set("textContent", input.textContent);
    if (input.file) formData.set("file", input.file);

    return apiRequest<ProjectDocument>(`/api/projects/${projectId}/documents`, {
      method: "POST",
      body: formData,
    });
  },

  async updateDocument(
    projectId: string,
    documentId: string,
    input: UpdateProjectDocumentInput,
  ) {
    return apiRequest<ProjectDocument>(
      `/api/projects/${projectId}/documents/${documentId}`,
      {
        method: "PATCH",
        body: input,
      },
    );
  },

  async removeDocument(projectId: string, documentId: string) {
    return apiRequest<ProjectDocument>(
      `/api/projects/${projectId}/documents/${documentId}`,
      { method: "DELETE" },
    );
  },

  async updateStatus(projectId: string, input: UpdateProjectStatusInput) {
    return apiRequest<Project>(`/api/projects/${projectId}/status`, {
      method: "PATCH",
      body: {
        status: input.status,
        reason: input.reason || undefined,
      },
    });
  },

  async update(projectId: string, input: UpdateProjectInput) {
    return apiRequest<Project>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: input,
    });
  },

  async updateTypes(projectId: string, input: UpdateProjectTypesInput) {
    return apiRequest<Project>(`/api/projects/${projectId}/types`, {
      method: "PATCH",
      body: input,
    });
  },

  async updatePriority(projectId: string, input: UpdateProjectPriorityInput) {
    return apiRequest<Project>(`/api/projects/${projectId}/priority`, {
      method: "PATCH",
      body: {
        priority: input.priority,
        rushReason: input.rushReason || undefined,
      },
    });
  },

  async updateEstimatedHours(projectId: string, input: UpdateEstimatedHoursInput) {
    return apiRequest<Project>(`/api/projects/${projectId}/estimated-hours`, {
      method: "PATCH",
      body: input,
    });
  },

  async connectSlackChannel(
    projectId: string,
    input: ConnectSlackChannelInput = {},
  ) {
    return apiRequest<Project>(`/api/projects/${projectId}/slack-channel`, {
      method: "PATCH",
      body: input,
    });
  },

  async archive(projectId: string) {
    return apiRequest<Project>(`/api/projects/${projectId}/archive`, {
      method: "PATCH",
    });
  },

  async restore(projectId: string) {
    return apiRequest<Project>(`/api/projects/${projectId}/restore`, {
      method: "PATCH",
    });
  },

  async timeEntries(projectId: string, query?: TimeEntriesQuery) {
    return apiRequest<TimeEntriesResponse>(
      `/api/projects/${projectId}/time-entries${buildTimeEntriesQuery(query)}`,
    );
  },

  async dailyTimeSummary(projectId: string, query?: TimeEntriesQuery) {
    return apiRequest<ProjectDailyTimeSummary>(
      `/api/projects/${projectId}/time-entries/daily-summary${buildTimeEntriesQuery(query)}`,
    );
  },

  async projectTimeSummary(query?: ProjectSummaryQuery) {
    return apiRequest<ProjectTimeSummary>(
      `/api/time-entries/project-summary${buildProjectSummaryQuery(query)}`,
    );
  },

  async activeTimeEntry(userId?: string) {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return apiRequest<ActiveTimeEntryResponse>(`/api/time-entries/active${query}`);
  },

  async startTimeEntry(projectId: string, input: TimeEntryNoteInput = {}) {
    return apiRequest<TimeEntry>(`/api/projects/${projectId}/time-entries/start`, {
      method: "POST",
      body: input,
    });
  },

  async pauseTimeEntry(
    projectId: string,
    entryId: string,
    input: TimeEntryNoteInput = {},
  ) {
    return apiRequest<TimeEntry>(
      `/api/projects/${projectId}/time-entries/${entryId}/pause`,
      { method: "PATCH", body: input },
    );
  },

  async resumeTimeEntry(
    projectId: string,
    entryId: string,
    input: TimeEntryNoteInput = {},
  ) {
    return apiRequest<TimeEntry>(
      `/api/projects/${projectId}/time-entries/${entryId}/resume`,
      { method: "PATCH", body: input },
    );
  },

  async stopTimeEntry(
    projectId: string,
    entryId: string,
    input: TimeEntryNoteInput = {},
  ) {
    return apiRequest<TimeEntry>(
      `/api/projects/${projectId}/time-entries/${entryId}/stop`,
      { method: "PATCH", body: input },
    );
  },

  async create(input: CreateProjectInput) {
    return apiRequest<Project>("/api/projects", {
      method: "POST",
      body: {
        name: input.name,
        description: input.description || undefined,
        clientId: input.clientId,
        projectTypes: input.projectTypes,
        plannedStartDate: input.plannedStartDate || undefined,
        deadline: input.deadline || undefined,
      },
    });
  },
};
