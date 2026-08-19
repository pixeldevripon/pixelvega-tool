"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Filter,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import {
  blockersApi,
  type Blocker,
  type BlockerQuery,
  type BlockerSeverity,
  type BlockerStatus,
} from "@/lib/api/blockers";
import { projectsApi, type Project } from "@/lib/api/projects";
import { userStore } from "@/lib/api/user-store";
import type { AppUser, UserRole } from "@/types/auth";

const ALL_VALUE = "ALL";
const PAGE_SIZE = 20;
const METRICS_PAGE_SIZE = 100;

const STATUS_LABELS: Record<BlockerStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

const SEVERITY_LABELS: Record<BlockerSeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const STATUS_TONES: Record<
  BlockerStatus,
  "default" | "primary" | "success" | "warning"
> = {
  OPEN: "warning",
  IN_PROGRESS: "primary",
  RESOLVED: "success",
};

const VIEW_ROLES: UserRole[] = [
  "SYSTEM_ADMIN",
  "ADMIN",
  "PROJECT_MANAGER",
  "DEVELOPER",
  "DESIGNER",
];

type GlobalMetrics = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  highSeverity: number;
  deadlineExtensionDays: number;
  totalResolutionMinutes: number;
};

function personName(person?: Pick<AppUser, "name" | "email"> | null) {
  return person?.name || person?.email || "Workspace user";
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function severityTone(severity: BlockerSeverity) {
  if (severity === "HIGH") return "danger" as const;
  if (severity === "MEDIUM") return "warning" as const;
  return "default" as const;
}

function emptyMetrics(): GlobalMetrics {
  return {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    highSeverity: 0,
    deadlineExtensionDays: 0,
    totalResolutionMinutes: 0,
  };
}

function metricsFromBlockers(blockers: Blocker[]): GlobalMetrics {
  return blockers.reduce<GlobalMetrics>(
    (metrics, blocker) => {
      metrics.total += 1;
      if (blocker.status === "OPEN") metrics.open += 1;
      if (blocker.status === "IN_PROGRESS") metrics.inProgress += 1;
      if (blocker.status === "RESOLVED") metrics.resolved += 1;
      if (blocker.severity === "HIGH") metrics.highSeverity += 1;
      metrics.deadlineExtensionDays += blocker.deadlineExtensionDays ?? 0;
      metrics.totalResolutionMinutes += blocker.resolutionTime ?? 0;
      return metrics;
    },
    emptyMetrics(),
  );
}

function isScopedRole(role: UserRole) {
  return role === "DEVELOPER" || role === "DESIGNER";
}

function buildQuery(
  status: BlockerStatus | typeof ALL_VALUE,
  severity: BlockerSeverity | typeof ALL_VALUE,
  projectId: string,
  assignedToId: string,
): BlockerQuery {
  return {
    status: status === ALL_VALUE ? undefined : status,
    severity: severity === ALL_VALUE ? undefined : severity,
    projectId: projectId === ALL_VALUE ? undefined : projectId,
    assignedToId: assignedToId === ALL_VALUE ? undefined : assignedToId,
  };
}

async function loadAllMatchingBlockers(query: BlockerQuery) {
  const firstPage = await blockersApi.list({
    ...query,
    page: 1,
    pageSize: METRICS_PAGE_SIZE,
  });
  const pageCount = Math.ceil(firstPage.total / METRICS_PAGE_SIZE);

  if (pageCount <= 1) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      blockersApi.list({
        ...query,
        page: index + 2,
        pageSize: METRICS_PAGE_SIZE,
      }),
    ),
  );

  return [firstPage.items, ...remainingPages.map((result) => result.items)].flat();
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof AlertTriangle;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p>
          </div>
          <Icon size={20} className="text-primary" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

export function BlockersDashboard() {
  const { currentUser, users } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const role = currentUser?.role;
  const canView = Boolean(role && VIEW_ROLES.includes(role));
  const scopedToMembership = Boolean(role && isScopedRole(role));

  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [metrics, setMetrics] = useState<GlobalMetrics>(emptyMetrics());
  const [statusFilter, setStatusFilter] = useState<BlockerStatus | typeof ALL_VALUE>(ALL_VALUE);
  const [severityFilter, setSeverityFilter] = useState<BlockerSeverity | typeof ALL_VALUE>(ALL_VALUE);
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);
  const [assigneeFilter, setAssigneeFilter] = useState(ALL_VALUE);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [metricsError, setMetricsError] = useState("");

  const activeUsers = useMemo(
    () =>
      users
        .filter(
          (user) =>
            user.status === "ACTIVE" &&
            user.role !== "CLIENT" &&
            user.role !== "SYSTEM_ADMIN" &&
            user.role !== "ADMIN",
        )
        .sort((a, b) => personName(a).localeCompare(personName(b))),
    [users],
  );

  const query = useMemo(
    () => buildQuery(statusFilter, severityFilter, projectFilter, assigneeFilter),
    [assigneeFilter, projectFilter, severityFilter, statusFilter],
  );

  const loadResources = useCallback(async () => {
    if (!role || !canView) return;
    try {
      const projectResult = scopedToMembership
        ? await projectsApi.listMine({ page: 1, pageSize: 100 })
        : await projectsApi.list({ page: 1, pageSize: 100 });
      setProjects(projectResult.items.filter((project) => !project.archivedAt));
      if (users.length === 0) await userStore.loadUsers();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load blocker filters.");
    }
  }, [canView, role, scopedToMembership, users.length]);

  const loadBlockers = useCallback(
    async (refresh = false) => {
      if (!canView) return;
      setLoadError("");
      setMetricsError("");
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const pageResult = await blockersApi.list({
          ...query,
          page,
          pageSize: PAGE_SIZE,
        });
        setBlockers(pageResult.items);
        setTotal(pageResult.total);

        try {
          const allMatching = await loadAllMatchingBlockers(query);
          setMetrics(metricsFromBlockers(allMatching));
        } catch (error) {
          setMetricsError(
            error instanceof Error
              ? error.message
              : "Summary metrics are temporarily unavailable.",
          );
          setMetrics(metricsFromBlockers(pageResult.items));
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load blockers.");
        setBlockers([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [canView, page, query],
  );

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => void loadResources(), 0);
    return () => window.clearTimeout(timer);
  }, [canView, loadResources]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadBlockers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadBlockers]);

  function updateFilter<T extends string>(setter: (value: T) => void, value: T) {
    setPage(1);
    setter(value);
  }

  if (!currentUser) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  if (!canView) {
    return (
      <Alert>
        <ShieldAlert size={18} />
        <AlertTitle>Blockers are internal</AlertTitle>
        <AlertDescription>
          Blocker visibility is limited to project staff and administrators.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={22} className="text-amber-600" aria-hidden="true" />
            <Badge tone="primary">Internal operations</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Blocker dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
            {scopedToMembership
              ? "Review blockers from projects where you are an active team member."
              : "Monitor unresolved work blockers across the projects you can manage."}
          </p>
        </div>
        <Button variant="outline" disabled={isRefreshing} onClick={() => void loadBlockers(true)}>
          {isRefreshing ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
          Refresh
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Blocker summary">
        <MetricCard label="Matching blockers" value={metrics.total} detail="Across current filters" icon={AlertTriangle} />
        <MetricCard label="Needs attention" value={metrics.open + metrics.inProgress} detail={`${metrics.open} open · ${metrics.inProgress} in progress`} icon={Clock3} />
        <MetricCard label="High severity" value={metrics.highSeverity} detail="Within current filters" icon={AlertTriangle} />
        <MetricCard label="Deadline impact" value={`${metrics.deadlineExtensionDays}d`} detail={`${metrics.resolved} resolved · ${formatMinutes(metrics.totalResolutionMinutes)} resolution time`} icon={CheckCircle2} />
      </section>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-primary" aria-hidden="true" />
            <CardTitle className="text-lg">Filter blockers</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label htmlFor="blocker-status" className="text-sm font-bold">Status</label>
              <Select value={statusFilter} onValueChange={(value) => updateFilter(setStatusFilter, value as BlockerStatus | typeof ALL_VALUE)}>
                <SelectTrigger id="blocker-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="blocker-severity" className="text-sm font-bold">Severity</label>
              <Select value={severityFilter} onValueChange={(value) => updateFilter(setSeverityFilter, value as BlockerSeverity | typeof ALL_VALUE)}>
                <SelectTrigger id="blocker-severity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All severities</SelectItem>
                  {Object.entries(SEVERITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="blocker-project" className="text-sm font-bold">Project</label>
              <Select value={projectFilter} onValueChange={(value) => updateFilter(setProjectFilter, value)}>
                <SelectTrigger id="blocker-project"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All visible projects</SelectItem>
                  {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="blocker-assignee" className="text-sm font-bold">Assignee</label>
              <Select value={assigneeFilter} onValueChange={(value) => updateFilter(setAssigneeFilter, value)}>
                <SelectTrigger id="blocker-assignee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All assignees</SelectItem>
                  {activeUsers.map((user) => <SelectItem key={user.id} value={user.id}>{personName(user)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {metricsError ? <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-400">Showing page-level fallback metrics: {metricsError}</p> : null}
        </CardContent>
      </Card>

      {loadError ? <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert> : null}
      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-28 w-full rounded-lg" /><Skeleton className="h-28 w-full rounded-lg" /></div>
      ) : blockers.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <AlertTriangle size={30} className="mx-auto text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-extrabold">No blockers match these filters</h2>
            <p className="mt-2 text-sm font-medium text-muted-foreground">Try widening the filters or check back after a blocker is reported.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Blocker results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <caption className="sr-only">Cross-project blocker results</caption>
                <thead className="border-b border-border text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-3">Blocker</th>
                    <th scope="col" className="px-3 py-3">Project</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3">Severity</th>
                    <th scope="col" className="px-3 py-3">Assigned to</th>
                    <th scope="col" className="px-3 py-3">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {blockers.map((blocker) => (
                    <tr key={blocker.id} className="align-top">
                      <td className="max-w-[340px] px-3 py-4">
                        <p className="font-extrabold leading-5">{blocker.description}</p>
                        <p className="mt-2 text-xs font-semibold text-muted-foreground">
                          {blocker.reason?.name || "Unspecified"} · reported by {personName(blocker.reportedBy)} · {formatDateTime(blocker.createdAt)}
                        </p>
                      </td>
                      <td className="px-3 py-4 font-bold">
                        {blocker.project ? (
                          <Link className="text-primary underline-offset-4 hover:underline" href={`/dashboard/projects/${blocker.project.id}`}>
                            {blocker.project.name}
                          </Link>
                        ) : "Unknown project"}
                      </td>
                      <td className="px-3 py-4"><Badge tone={STATUS_TONES[blocker.status]}>{STATUS_LABELS[blocker.status]}</Badge></td>
                      <td className="px-3 py-4"><Badge tone={severityTone(blocker.severity)}>{SEVERITY_LABELS[blocker.severity]}</Badge></td>
                      <td className="px-3 py-4 font-semibold">{blocker.assignedTo ? personName(blocker.assignedTo) : "Unassigned"}</td>
                      <td className="px-3 py-4 font-semibold text-muted-foreground">
                        {blocker.status === "RESOLVED" ? `Resolved in ${formatMinutes(blocker.resolutionTime ?? 0)}` : `${blocker.daysOpen ?? 0} day(s) open`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5">
              <PaginationControls page={page} total={total} pageSize={PAGE_SIZE} disabled={isLoading || isRefreshing} onPageChange={setPage} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
