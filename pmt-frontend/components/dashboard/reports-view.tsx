"use client";

import {
  Activity,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingTimer } from "@/components/dashboard/meeting-timer";
import { projectsApi, type Project } from "@/lib/api/projects";
import {
  reportsApi,
  type DeveloperReport,
  type DeveloperReportQuery,
} from "@/lib/api/reports";
import { userStore } from "@/lib/api/user-store";
import type { AppUser } from "@/types/auth";

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { startDate: dateInput(start), endDate: dateInput(end) };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function formatHours(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}h`;
}

function formatMinutes(value: number | null) {
  if (value === null) return "No resolved blockers";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}m avg.` : `${minutes}m avg.`;
}

function displayUser(user?: Pick<AppUser, "name" | "email"> | null) {
  return user?.name || user?.email || "Workspace user";
}

function percent(value: number | null) {
  return value === null ? "Not available" : `${Math.round(value * 100)}%`;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      {detail ? <div className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</div> : null}
    </div>
  );
}

type ReportsViewProps = {
  currentUser: AppUser;
  users: AppUser[];
};

export function ReportsView({ currentUser, users }: ReportsViewProps) {
  const [draftRange, setDraftRange] = useState(defaultRange);
  const [appliedQuery, setAppliedQuery] = useState<DeveloperReportQuery>(() => ({
    ...defaultRange(),
  }));
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id);
  const [selectedProjectId, setSelectedProjectId] = useState("ALL");
  const [projects, setProjects] = useState<Project[]>([]);
  const [report, setReport] = useState<DeveloperReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const canViewOthers =
    currentUser.role === "PROJECT_MANAGER" ||
    currentUser.role === "ADMIN" ||
    currentUser.role === "SYSTEM_ADMIN";

  const reportUsers = useMemo(
    () =>
      (Array.isArray(users) ? users : [])
        .filter(
          (user) =>
            user.role === "DEVELOPER" ||
            user.role === "DESIGNER" ||
            user.role === "PROJECT_MANAGER",
        )
        .sort((a, b) => displayUser(a).localeCompare(displayUser(b))),
    [users],
  );

  const loadReport = useCallback(
    async (query: DeveloperReportQuery, refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError("");
      try {
        setReport(await reportsApi.developer(query));
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : "Unable to load report.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReport(appliedQuery);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [appliedQuery, loadReport]);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      await userStore.loadUsers();
      try {
        const result = canViewOthers
          ? await projectsApi.list({ page: 1, pageSize: 100 })
          : await projectsApi.listMine({ page: 1, pageSize: 100 });
        setProjects(result.items);
      } catch {
        setProjects([]);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [canViewOthers]);

  function applyFilters() {
    const query: DeveloperReportQuery = {
      startDate: draftRange.startDate,
      endDate: draftRange.endDate,
      ...(canViewOthers ? { userId: selectedUserId } : {}),
      ...(selectedProjectId !== "ALL" ? { projectId: selectedProjectId } : {}),
    };
    setAppliedQuery(query);
  }

  const projectHoursMax = Math.max(
    1,
    ...(report?.hoursByProject.map((item) => item.totalHours) ?? []),
  );
  const dayHoursMax = Math.max(
    1,
    ...(report?.hoursByDay.map((item) => item.totalMinutes) ?? []),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <BarChart3 size={24} className="mt-0.5 text-primary" />
            <div>
              <h1 className="text-2xl font-black tracking-tight">Reports</h1>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Calculated activity reports from time, standups, blockers, leave, and project history.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={isLoading || isRefreshing}
            onClick={() => void loadReport(appliedQuery, true)}
          >
            {isRefreshing ? <Loader2 size={17} className="animate-spin" /> : <RefreshCcw size={17} />}
            Refresh
          </Button>
        </div>

        <div className="mt-5 grid gap-4 rounded-md border border-border bg-muted/20 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          {canViewOthers ? (
            <div className="space-y-2">
              <label className="text-sm font-bold">Person</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger><SelectValue placeholder="Select a person" /></SelectTrigger>
                <SelectContent>
                  {reportUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{displayUser(user)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-bold">From</label>
            <Input type="date" value={draftRange.startDate} onChange={(event) => setDraftRange((current) => ({ ...current, startDate: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">To</label>
            <Input type="date" value={draftRange.endDate} onChange={(event) => setDraftRange((current) => ({ ...current, endDate: event.target.value }))} />
          </div>
          <div className="flex items-end gap-2">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="min-w-40"><SelectValue placeholder="All projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All projects</SelectItem>
                {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button disabled={isLoading || isRefreshing || !draftRange.startDate || !draftRange.endDate} onClick={applyFilters}>Apply</Button>
          </div>
        </div>
      </section>

      <MeetingTimer currentUser={currentUser} />

      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-28 rounded-lg" /><Skeleton className="h-28 rounded-lg" /><Skeleton className="h-28 rounded-lg" /></div>
      ) : report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Project hours" value={formatHours(report.projectHours)} />
            <MetricCard label="Meeting hours" value={formatHours(report.meetingHours)} />
            <MetricCard label="Total hours" value={formatHours(report.totalHours)} detail={`${percent(report.hoursGoalRate)} of goal`} />
            <MetricCard label="Working days" value={String(report.workingDaysInRange)} detail={`${report.leaveDaysTaken} leave days`} />
            <MetricCard label="Blockers" value={`${report.blockersReported} / ${report.blockersResolved}`} detail="Reported / resolved" />
            <MetricCard label="Projects touched" value={String(report.projectsTouched.length)} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2"><Activity size={20} className="text-primary" /><div><h2 className="text-lg font-extrabold">Hours by project</h2><p className="text-sm font-medium text-muted-foreground">Project time in the selected range.</p></div></div>
              {report.hoursByProject.length ? <div className="space-y-4">{report.hoursByProject.map((item) => <div key={item.projectId}><div className="mb-1 flex justify-between gap-3 text-sm font-bold"><span className="truncate">{item.projectName || "Unnamed project"}</span><span>{formatHours(item.totalHours)}</span></div><div className="h-2.5 rounded-full bg-muted"><div className="h-2.5 rounded-full bg-primary" style={{ width: `${Math.max(3, (item.totalHours / projectHoursMax) * 100)}%` }} /></div></div>)}</div> : <p className="text-sm font-medium text-muted-foreground">No project time recorded.</p>}
            </section>

            <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2"><CalendarRange size={20} className="text-primary" /><div><h2 className="text-lg font-extrabold">Hours by day</h2><p className="text-sm font-medium text-muted-foreground">Project and meeting time across the range.</p></div></div>
              {report.hoursByDay.length ? <div className="space-y-3">{report.hoursByDay.map((item) => <div key={item.date} className="grid grid-cols-[92px_minmax(0,1fr)_56px] items-center gap-3 text-sm"><span className="font-bold text-muted-foreground">{formatDate(item.date).split(",")[0]}</span><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-sky-500" style={{ width: `${Math.max(3, (item.totalMinutes / dayHoursMax) * 100)}%` }} title={`Project ${formatHours(item.projectMinutes / 60)} · Meeting ${formatHours(item.meetingMinutes / 60)}`} /></div><span className="text-right font-extrabold">{formatHours(item.totalMinutes / 60)}</span></div>)}</div> : <p className="text-sm font-medium text-muted-foreground">No time recorded.</p>}
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><CheckCircle2 size={20} className="text-primary" /><h2 className="text-lg font-extrabold">Daily work compliance</h2></div><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="font-semibold text-muted-foreground">Days planned</span><strong>{report.dailyWorkReportCompliance.daysPlanned}</strong></div><div className="flex justify-between"><span className="font-semibold text-muted-foreground">Days wrapped up</span><strong>{report.dailyWorkReportCompliance.daysWrappedUp}</strong></div><div className="flex justify-between"><span className="font-semibold text-muted-foreground">Plan follow-through</span><strong>{percent(report.dailyWorkReportCompliance.planFollowThroughRate)}</strong></div><div className="flex justify-between"><span className="font-semibold text-muted-foreground">Open plans</span><strong>{report.dailyWorkReportCompliance.openPlansWithoutWrapUp}</strong></div></div></section>
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Clock3 size={20} className="text-primary" /><h2 className="text-lg font-extrabold">Blockers & leave</h2></div><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="font-semibold text-muted-foreground">Blockers resolved</span><strong>{report.blockersResolved}</strong></div><div className="flex justify-between"><span className="font-semibold text-muted-foreground">Avg. resolution</span><strong>{formatMinutes(report.averageResolutionMinutes)}</strong></div><div className="flex justify-between"><span className="font-semibold text-muted-foreground">Leave days</span><strong>{report.leaveDaysTaken}</strong></div></div></section>
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Users size={20} className="text-primary" /><h2 className="text-lg font-extrabold">Projects touched</h2></div><div className="space-y-2">{report.projectsTouched.length ? report.projectsTouched.map((item) => <div key={item.projectId} className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-bold">{item.projectName || "Unnamed project"}</span><Badge tone={item.active ? "success" : "default"}>{item.active ? "Active" : "Historical"}</Badge></div>) : <p className="text-sm font-medium text-muted-foreground">No projects touched.</p>}</div></section>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ReportsPageContainer() {
  const { currentUser, users } = useSyncExternalStore(userStore.subscribe, userStore.getSnapshot, userStore.getServerSnapshot);
  if (!currentUser) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (currentUser.role === "CLIENT") {
    return <Alert variant="destructive"><AlertDescription>Reports are available to internal project roles only.</AlertDescription></Alert>;
  }
  return <ReportsView currentUser={currentUser} users={Array.isArray(users) ? users : []} />;
}
