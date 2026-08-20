import type { EnumDisplay } from '@/contexts/role-context';

/** `GET /leave/requests`, mirrored from the backend's leave DTO. */

export type LeaveRequestCapabilities = {
    canApprove: boolean;
    canReject: boolean;
    canCancel: boolean;
};

export type LeaveRequest = {
    id: string;
    userId: string;
    user: { id: string; name: string; email: string; role: EnumDisplay } | null;
    leaveType: { id: string; name: string; defaultDaysPerYear: number } | null;
    startDate: string;
    endDate: string;
    days: number;
    reason: string | null;
    status: EnumDisplay;
    isPending: boolean;
    reviewedBy: { id: string; name: string } | null;
    reviewedAt: string | null;
    createdAt: string;
    /**
     * A project manager reads every request and opens any of them, but only an
     * Admin may approve or reject. That distinction is a real rule rather than an
     * oversight, and it arrives here so a screen never has to infer it.
     */
    capabilities: LeaveRequestCapabilities;
};

/**
 * What `GET /leave/requests` accepts.
 *
 * `status` NARROWS what the caller's role already permits, it never widens it: a
 * PROJECT_MANAGER asking for REJECTED gets an empty page, because the backend
 * intersects the filter with the statuses their role may see at all.
 */
export type LeaveRequestsQuery = {
    page?: number;
    pageSize?: number;
    status?: string;
    userId?: string;
    leaveTypeId?: string;
};
