"use client";

import { FileClock, Filter, RotateCcw, Search } from "lucide-react";
import {
  FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  auditLogsApi,
  type AuditLogEntry,
  type AuditLogMetadata,
} from "@/lib/api/audit-logs";
import { userStore } from "@/lib/api/user-store";
import { roleLabels } from "@/lib/auth-meta";
import type { UserRole } from "@/types/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;
const ALL_VALUE = "ALL";

const targetTypes = [
  "User",
  "EmployeeProfile",
  "ClientProfile",
  "LeaveRequest",
  "LeaveType",
  "Holiday",
];

const actionLabels: Record<string, string> = {
  "holiday.created": "Created holiday",
  "holiday.deleted": "Deleted holiday",
  "holiday.updated": "Updated holiday",
  "leave.approved": "Approved leave",
  "leave.cancelled": "Cancelled leave",
  "leave.rejected": "Rejected leave",
  "leave.requested": "Requested leave",
  "leave_type.created": "Created leave type",
  "leave_type.deleted": "Deleted leave type",
  "leave_type.updated": "Updated leave type",
  "profile.avatar_updated": "Updated avatar",
  "profile.updated": "Updated profile",
  "user.deleted": "Deleted user",
  "user.invited": "Invited user",
  "user.password_changed": "Changed password",
  "user.password_reset": "Reset password",
  "user.updated": "Updated user",
};

const compactRoleLabels: Record<UserRole, string> = {
  SYSTEM_ADMIN: "Sys Admin",
  ADMIN: "Admin",
  PROJECT_MANAGER: "PM",
  DESIGNER: "Designer",
  DEVELOPER: "Developer",
  CLIENT: "Client",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAction(action: string) {
  return actionLabels[action] ?? action.replace(/[._]/g, " ");
}

function formatTarget(entry: AuditLogEntry) {
  if (!entry.targetType && !entry.targetId) return "Workspace";
  if (!entry.targetId) return entry.targetType ?? "Unknown target";
  return `${entry.targetType ?? "Target"} ${entry.targetId.slice(0, 8)}`;
}

function formatActorOptionLabel(name: string, role: string) {
  return `${name} (${role})`;
}

function metadataHasContent(metadata: AuditLogMetadata | undefined) {
  if (metadata === undefined || metadata === null) return false;
  if (Array.isArray(metadata)) return metadata.length > 0;
  if (typeof metadata === "object") return Object.keys(metadata).length > 0;
  return true;
}

function isMetadataRecord(
  value: AuditLogMetadata | undefined,
): value is { [key: string]: AuditLogMetadata } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function humanizeKey(key: string) {
  return key
    .replace(/Id$/, " ID")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetadataText(value: AuditLogMetadata | undefined): string {
  if (value === undefined) return "Not recorded";
  if (value === null) return "None";
  if (Array.isArray(value)) return value.map((item) => formatMetadataText(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isChangeValue(
  value: AuditLogMetadata,
): value is { from?: AuditLogMetadata; to?: AuditLogMetadata } {
  return isMetadataRecord(value) && ("from" in value || "to" in value);
}

function getMetadataSummary(entry: AuditLogEntry) {
  const metadata = entry.metadata;
  if (!metadataHasContent(metadata)) return "No additional details";
  if (!isMetadataRecord(metadata)) return "Details available";

  if (isMetadataRecord(metadata.changes)) {
    const count = Object.keys(metadata.changes).length;
    return `${count} ${count === 1 ? "field" : "fields"} changed`;
  }
  if (typeof metadata.reason === "string") return "Reason recorded";
  if (typeof metadata.days === "number") {
    return `${metadata.days} ${metadata.days === 1 ? "day" : "days"}`;
  }
  if (typeof metadata.name === "string") return metadata.name;
  if (typeof metadata.publicId === "string") return "Upload reference recorded";

  const count = Object.keys(metadata).length;
  return `${count} ${count === 1 ? "detail" : "details"}`;
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-md border border-border bg-card p-3 sm:grid-cols-[150px_1fr]">
      <dt className="text-xs font-extrabold uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm font-semibold text-foreground">
        {children}
      </dd>
    </div>
  );
}

function renderReadableMetadata(entry: AuditLogEntry) {
  const metadata = entry.metadata;
  if (!metadataHasContent(metadata)) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm font-semibold text-muted-foreground">
        No metadata recorded for this event.
      </div>
    );
  }

  if (!isMetadataRecord(metadata)) {
    return (
      <dl className="space-y-2">
        <DetailRow label="Value">{formatMetadataText(metadata)}</DetailRow>
      </dl>
    );
  }

  if (isMetadataRecord(metadata.changes)) {
    return (
      <dl className="space-y-2">
        {Object.entries(metadata.changes).map(([field, change]) =>
          isChangeValue(change) ? (
            <DetailRow key={field} label={humanizeKey(field)}>
              <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                  {formatMetadataText(change.from)}
                </span>
                <span className="text-xs font-extrabold uppercase text-muted-foreground">
                  to
                </span>
                <span className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
                  {formatMetadataText(change.to)}
                </span>
              </div>
            </DetailRow>
          ) : (
            <DetailRow key={field} label={humanizeKey(field)}>
              {renderMetadataValue(change)}
            </DetailRow>
          ),
        )}
      </dl>
    );
  }

  return (
    <dl className="space-y-2">
      {Object.entries(metadata).map(([key, value]) => (
        <DetailRow key={key} label={humanizeKey(key)}>
          {isMetadataRecord(value) || Array.isArray(value)
            ? renderMetadataValue(value)
            : formatMetadataText(value)}
        </DetailRow>
      ))}
    </dl>
  );
}

function renderMetadataValue(value: AuditLogMetadata) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (Array.isArray(value)) {
    return (
      <div className="space-y-1">
        {value.map((item, index) => (
          <div key={index}>{renderMetadataValue(item)}</div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <dl className="space-y-2">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="grid gap-1 sm:grid-cols-[150px_1fr]">
            <dt className="text-xs font-extrabold uppercase text-muted-foreground">
              {key}
            </dt>
            <dd className="break-words text-sm font-semibold text-foreground">
              {renderMetadataValue(item)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{String(value)}</span>;
}

export function AuditLogsView({
  initialActorId,
  initialTargetId,
  initialTargetType,
}: {
  initialActorId?: string;
  initialTargetId?: string;
  initialTargetType?: string;
} = {}) {
  const { currentUser, users } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actorId, setActorId] = useState(initialActorId || ALL_VALUE);
  const [targetType, setTargetType] = useState(initialTargetType || ALL_VALUE);
  const [targetId, setTargetId] = useState(initialTargetId || "");
  const [draftTargetId, setDraftTargetId] = useState(initialTargetId || "");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const canViewAuditLogs =
    currentUser?.role === "SYSTEM_ADMIN" || currentUser?.role === "ADMIN";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstVisibleItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastVisibleItem = Math.min(page * PAGE_SIZE, total);
  const activeFilterCount = [actorId !== ALL_VALUE, targetType !== ALL_VALUE, targetId]
    .filter(Boolean)
    .length;

  const actorOptions = useMemo(
    () => {
      const options = new Map<
        string,
        { id: string; label: string; description: string }
      >();

      users.forEach((user) => {
        const roleLabel = compactRoleLabels[user.role];
        options.set(user.id, {
          id: user.id,
          label: formatActorOptionLabel(user.name || user.email, roleLabel),
          description: `${user.email} • ${roleLabels[user.role]}`,
        });
      });

      logs.forEach((log) => {
        if (!log.userId || options.has(log.userId)) return;
        const name = log.user?.name ?? log.user?.email ?? "Deleted user";
        options.set(log.userId, {
          id: log.userId,
          label: formatActorOptionLabel(name, "N/A"),
          description: log.user?.email ?? log.userId,
        });
      });

      return Array.from(options.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      );
    },
    [logs, users],
  );

  useEffect(() => {
    if (canViewAuditLogs) {
      void userStore.loadUsers();
    }
  }, [canViewAuditLogs]);

  useEffect(() => {
    if (!canViewAuditLogs) {
      return;
    }

    let active = true;

    async function loadAuditLogs() {
      setIsLoading(true);
      setError("");

      try {
        const result = await auditLogsApi.list({
          page,
          pageSize: PAGE_SIZE,
          userId: actorId === ALL_VALUE ? undefined : actorId,
          targetType: targetType === ALL_VALUE ? undefined : targetType,
          targetId: targetId.trim() || undefined,
        });
        if (!active) return;
        setLogs(result.items);
        setTotal(result.total);
      } catch (error) {
        if (!active) return;
        setError(
          error instanceof Error ? error.message : "Unable to load audit logs.",
        );
        setLogs([]);
        setTotal(0);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadAuditLogs();

    return () => {
      active = false;
    };
  }, [actorId, canViewAuditLogs, page, targetId, targetType]);

  function applyTargetFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setTargetId(draftTargetId.trim());
  }

  function resetFilters() {
    setActorId(ALL_VALUE);
    setTargetType(ALL_VALUE);
    setTargetId("");
    setDraftTargetId("");
    setPage(1);
  }

  const selectedActor = actorOptions.find((actor) => actor.id === actorId);

  if (currentUser && !canViewAuditLogs) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Audit logs are available to admins only.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Audit logs
            </h1>
            <p className="mt-2 max-w-3xl text-base font-medium text-muted-foreground">
              Review account, leave, profile, holiday, and configuration changes across the workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="primary">{total} events</Badge>
            {activeFilterCount ? (
              <Badge tone="warning">{activeFilterCount} filters</Badge>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[220px_220px_1fr_auto] lg:items-end">
          <div className="space-y-2">
            <label className="text-sm font-bold" htmlFor="audit-actor">
              Actor
            </label>
            <Select
              value={actorId}
              onValueChange={(value) => {
                setActorId(value);
                setPage(1);
              }}
            >
              <SelectTrigger
                id="audit-actor"
                className="[&>span]:truncate"
                title={selectedActor?.description}
              >
                <SelectValue placeholder="All actors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All actors</SelectItem>
                {actorOptions.map((actor) => (
                  <SelectItem
                    key={actor.id}
                    value={actor.id}
                    title={actor.description}
                  >
                    {actor.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold" htmlFor="audit-target-type">
              Target type
            </label>
            <Select
              value={targetType}
              onValueChange={(value) => {
                setTargetType(value);
                setPage(1);
              }}
            >
              <SelectTrigger id="audit-target-type">
                <SelectValue placeholder="All targets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All targets</SelectItem>
                {targetTypes.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <form className="space-y-2" onSubmit={applyTargetFilter}>
            <label className="text-sm font-bold" htmlFor="audit-target-id">
              Target ID
            </label>
            <div className="flex gap-2">
              <Input
                id="audit-target-id"
                value={draftTargetId}
                onChange={(event) => setDraftTargetId(event.target.value)}
                placeholder="Paste an exact target id"
              />
              <Button aria-label="Apply target id filter" type="submit">
                <Search size={17} />
              </Button>
            </div>
          </form>

          <Button
            disabled={!activeFilterCount && !draftTargetId}
            variant="outline"
            onClick={resetFilters}
          >
            <RotateCcw size={17} />
            Reset
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-left">
            <thead className="bg-muted text-sm font-extrabold text-muted-foreground">
              <tr>
                <th className="px-5 py-4">Time</th>
                <th className="px-5 py-4">Actor</th>
                <th className="px-5 py-4">Action</th>
                <th className="px-5 py-4">Target</th>
                <th className="px-5 py-4">Metadata</th>
                <th className="px-5 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8">
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-11/12" />
                      <Skeleton className="h-5 w-10/12" />
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <FileClock size={23} />
                    </div>
                    <p className="mt-3 text-sm font-extrabold">
                      No audit events found
                    </p>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      Adjust the filters or come back after workspace activity.
                    </p>
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? logs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/50">
                      <td className="px-5 py-4 text-sm font-semibold text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-extrabold">
                          {entry.user?.name ?? "System"}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">
                          {entry.user?.email ?? entry.userId ?? "Automated event"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone="primary">{formatAction(entry.action)}</Badge>
                        <div className="mt-1 text-xs font-semibold text-muted-foreground">
                          {entry.action}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold">{formatTarget(entry)}</div>
                        {entry.targetId ? (
                          <div className="text-xs font-semibold text-muted-foreground">
                            {entry.targetId}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-muted-foreground">
                        {getMetadataSummary(entry)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          disabled={!metadataHasContent(entry.metadata)}
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedLog(entry)}
                        >
                          <Filter size={16} />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-muted-foreground">
            Showing {firstVisibleItem}-{lastVisibleItem} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              disabled={isLoading || page <= 1}
              size="sm"
              variant="outline"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </Button>
            <Badge>
              Page {page} of {totalPages}
            </Badge>
            <Button
              disabled={isLoading || page >= totalPages}
              size="sm"
              variant="outline"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audit event details</DialogTitle>
            <DialogDescription>
              {selectedLog
                ? `${formatAction(selectedLog.action)} by ${
                    selectedLog.user?.name ?? "System"
                  } on ${formatDateTime(selectedLog.createdAt)}.`
                : "Review the selected audit event."}
            </DialogDescription>
          </DialogHeader>

          {selectedLog ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold uppercase text-muted-foreground">
                    Actor
                  </div>
                  <div className="mt-1 break-words text-sm font-bold">
                    {selectedLog.user?.name ?? "System"}
                  </div>
                  <div className="break-all text-xs font-semibold text-muted-foreground">
                    {selectedLog.user?.email ?? selectedLog.userId ?? "Automated event"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold uppercase text-muted-foreground">
                    Target
                  </div>
                  <div className="mt-1 break-words text-sm font-bold">
                    {formatTarget(selectedLog)}
                  </div>
                  <div className="break-all text-xs font-semibold text-muted-foreground">
                    {selectedLog.targetId ?? "No target id"}
                  </div>
                </div>
              </div>

              <div className="max-h-80 overflow-auto rounded-lg border border-border p-4">
                {renderReadableMetadata(selectedLog)}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
