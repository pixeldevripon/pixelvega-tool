"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck,
  FileClock,
  Mail,
  Phone,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  auditLogsApi,
  type AuditLogEntry,
} from "@/lib/api/audit-logs";
import { leaveApi, type LeaveRequest, type LeaveStatus } from "@/lib/api/leave";
import { profilesApi } from "@/lib/api/profiles";
import { userStore } from "@/lib/api/user-store";
import { usersApi } from "@/lib/api/users";
import { roleLabels } from "@/lib/auth-meta";
import { getProfilePhone, getProfileTitle } from "@/lib/profile-utils";
import type { AppUser, UserProfile, UserStatus } from "@/types/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: UserStatus) {
  if (status === "ACTIVE") return "success";
  if (status === "INVITED") return "warning";
  return "danger";
}

function leaveStatusTone(status: LeaveStatus) {
  if (status === "APPROVED") return "success";
  if (status === "PENDING") return "warning";
  if (status === "REJECTED") return "danger";
  return "default";
}

function initialsFor(user: AppUser | UserProfile | null) {
  const source = user?.name || user?.email || "User";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatAction(action: string) {
  return action.replace(/[._]/g, " ");
}

function mergeAuditLogs(...groups: AuditLogEntry[][]) {
  const entries = new Map<string, AuditLogEntry>();
  groups.flat().forEach((entry) => entries.set(entry.id, entry));
  return Array.from(entries.values())
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 8);
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-extrabold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-bold text-foreground">
        {value || "Not available"}
      </div>
    </div>
  );
}

export function UserDetailView({ userId }: { userId: string }) {
  const { currentUser } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const canViewUser =
    currentUser?.role === "SYSTEM_ADMIN" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "PROJECT_MANAGER";
  const canViewAuditLogs =
    currentUser?.role === "SYSTEM_ADMIN" || currentUser?.role === "ADMIN";
  const canViewLeaveHistory =
    currentUser?.role === "SYSTEM_ADMIN" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "PROJECT_MANAGER";

  const profileTitle = getProfileTitle(profile);
  const profilePhone = getProfilePhone(profile);
  const auditActorHref = `/dashboard/audit-logs?userId=${userId}`;
  const auditTargetHref = `/dashboard/audit-logs?targetType=User&targetId=${userId}`;

  const profileDetails = useMemo(() => {
    if (!profile) return [];
    if (profile.role === "CLIENT") {
      return [
        ["Company", profile.clientProfile?.companyName],
        ["Billing email", profile.clientProfile?.billingEmail],
        ["Phone", profile.clientProfile?.phone],
        ["Timezone", profile.clientProfile?.timezone],
      ] as const;
    }
    return [
      ["Designation", profile.employeeProfile?.designation],
      ["Phone", profile.employeeProfile?.phone],
      ["Timezone", profile.employeeProfile?.timezone],
      ["Work status", profile.employeeProfile?.currentStatus],
      ["Availability", profile.employeeProfile?.availabilityStatus],
      ["Bio", profile.employeeProfile?.bio],
    ] as const;
  }, [profile]);

  useEffect(() => {
    if (!canViewUser) {
      return;
    }

    let active = true;

    async function loadUserDetail() {
      setIsLoading(true);
      setError("");

      try {
        const [userResult, profileResult, leaveResult, actorAudit, targetAudit] =
          await Promise.allSettled([
            usersApi.findOne(userId),
            profilesApi.findByUserId(userId),
            canViewLeaveHistory
              ? leaveApi.listRequestsForReview(userId)
              : Promise.resolve([]),
            canViewAuditLogs
              ? auditLogsApi.list({ userId, pageSize: 5 })
              : Promise.resolve({ items: [] }),
            canViewAuditLogs
              ? auditLogsApi.list({
                  targetType: "User",
                  targetId: userId,
                  pageSize: 5,
                })
              : Promise.resolve({ items: [] }),
          ]);

        if (!active) return;

        if (userResult.status === "rejected") {
          throw userResult.reason;
        }

        setUser(userResult.value);
        setProfile(
          profileResult.status === "fulfilled" ? profileResult.value : null,
        );
        setLeaveRequests(
          leaveResult.status === "fulfilled" ? leaveResult.value : [],
        );
        setAuditLogs(
          mergeAuditLogs(
            actorAudit.status === "fulfilled" ? actorAudit.value.items : [],
            targetAudit.status === "fulfilled" ? targetAudit.value.items : [],
          ),
        );
      } catch (error) {
        if (!active) return;
        setError(error instanceof Error ? error.message : "Unable to load user.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadUserDetail();

    return () => {
      active = false;
    };
  }, [canViewAuditLogs, canViewLeaveHistory, canViewUser, userId]);

  if (currentUser && !canViewUser) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          User details are available to admins and project managers only.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-3xl space-y-4">
        <Link
          href="/dashboard/users"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80"
        >
          <ArrowLeft size={16} />
          Back to users
        </Link>
        <Alert variant="destructive">
          <AlertDescription>{error || "User not found."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      <Link
        href="/dashboard/users"
        className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80"
      >
        <ArrowLeft size={16} />
        Back to users
      </Link>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20 rounded-md">
              <AvatarImage src={profile?.avatarUrl ?? user.avatarUrl} alt="" />
              <AvatarFallback className="rounded-md text-lg font-extrabold">
                {initialsFor(profile ?? user)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                {user.name || user.email}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="primary">{roleLabels[user.role]}</Badge>
                <Badge tone={statusTone(user.status)}>{user.status}</Badge>
                {user.mustResetPassword ? (
                  <Badge tone="warning">Temporary password</Badge>
                ) : (
                  <Badge tone="success">Password set</Badge>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Mail size={16} />
                  {user.email}
                </span>
                {profilePhone ? (
                  <span className="inline-flex items-center gap-2">
                    <Phone size={16} />
                    {profilePhone}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {canViewAuditLogs ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={auditActorHref}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold transition hover:bg-muted"
              >
                <FileClock size={16} />
                Actor history
              </Link>
              <Link
                href={auditTargetHref}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold transition hover:bg-muted"
              >
                <FileClock size={16} />
                User record history
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck size={21} />
              Account
            </CardTitle>
            <CardDescription>
              Role, status, password state, and account timestamps.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <DetailItem label="User ID" value={user.id} />
            <DetailItem label="Role" value={roleLabels[user.role]} />
            <DetailItem label="Status" value={user.status} />
            <DetailItem
              label="Password state"
              value={user.mustResetPassword ? "Temporary password" : "Password set"}
            />
            <DetailItem label="Created" value={formatDateTime(user.createdAt)} />
            <DetailItem label="Updated" value={formatDateTime(user.updatedAt)} />
            <DetailItem label="Created by" value={user.createdById} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserCircle size={21} />
              Profile
            </CardTitle>
            <CardDescription>
              Contact and role-specific profile details.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <DetailItem label="Display title" value={profileTitle} />
            <DetailItem label="Profile email" value={profile?.email} />
            {profileDetails.map(([label, value]) => (
              <DetailItem key={label} label={label} value={value} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CalendarCheck size={21} />
            Leave history
          </CardTitle>
          <CardDescription>
            Requests currently visible to your role for this user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaveRequests.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="border-b border-border text-sm font-extrabold text-muted-foreground">
                  <tr>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Dates</th>
                    <th className="py-3 pr-4">Days</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leaveRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="py-3 pr-4 font-bold">
                        {request.leaveType?.name ?? request.leaveTypeId}
                      </td>
                      <td className="py-3 pr-4 text-sm font-semibold text-muted-foreground">
                        {formatDate(request.startDate)} - {formatDate(request.endDate)}
                      </td>
                      <td className="py-3 pr-4 text-sm font-bold">
                        {request.days}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={leaveStatusTone(request.status)}>
                          {request.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-sm font-semibold text-muted-foreground">
                        {formatDateTime(request.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm font-semibold text-muted-foreground">
              No leave requests are visible for this user.
            </div>
          )}
        </CardContent>
      </Card>

      {canViewAuditLogs ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileClock size={21} />
              Recent audit activity
            </CardTitle>
            <CardDescription>
              Latest events where this user was the actor or the user record target.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditLogs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead className="border-b border-border text-sm font-extrabold text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-4">Time</th>
                      <th className="py-3 pr-4">Action</th>
                      <th className="py-3 pr-4">Target</th>
                      <th className="py-3 pr-4">Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-3 pr-4 text-sm font-semibold text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </td>
                        <td className="py-3 pr-4 font-bold">
                          {formatAction(entry.action)}
                        </td>
                        <td className="py-3 pr-4 text-sm font-semibold text-muted-foreground">
                          {entry.targetType ?? "Workspace"}
                        </td>
                        <td className="py-3 pr-4 text-sm font-semibold text-muted-foreground">
                          {entry.user?.name ?? "System"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm font-semibold text-muted-foreground">
                No recent audit activity found for this user.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => window.history.back()}>
          Back
        </Button>
      </div>
    </div>
  );
}
