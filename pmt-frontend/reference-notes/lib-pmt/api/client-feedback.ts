import { apiRequest } from "@/lib/api/client";

export type ClientFeedbackDecision = "APPROVED" | "CHANGES_REQUESTED";

export type ClientFeedback = {
  id: string;
  projectId: string;
  clientId: string;
  recordedById?: string | null;
  decision: ClientFeedbackDecision;
  comments?: string | null;
  feedbackRound: number;
  createdAt: string;
  client?: {
    id: string;
    name: string;
    email: string;
  } | null;
  recordedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type ClientFeedbackResponse = {
  items: ClientFeedback[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateClientFeedbackInput = {
  decision: ClientFeedbackDecision;
  comments?: string;
};

export const clientFeedbackApi = {
  list(projectId: string, page = 1, pageSize = 10) {
    return apiRequest<ClientFeedbackResponse>(
      `/api/projects/${projectId}/reviews/client?page=${page}&pageSize=${pageSize}`,
    );
  },

  create(projectId: string, input: CreateClientFeedbackInput) {
    return apiRequest<ClientFeedback>(
      `/api/projects/${projectId}/reviews/client`,
      { method: "POST", body: input },
    );
  },
};
