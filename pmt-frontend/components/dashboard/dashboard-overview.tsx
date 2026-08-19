"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  FolderKanban,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type Project, type ProjectStatus, projectsApi } from "@/lib/api/projects";
import { userStore } from "@/lib/api/user-store";
import { roleLabels } from "@/lib/auth-meta";

const roleCopy = {
  SYSTEM_ADMIN: {
    title: "System Admin dashboard",
    body: "Oversee platform access, workspace administration, and operational readiness.",
  },
  ADMIN: {
    title: "Admin dashboard",
    body: "Monitor workspace access, project delivery, and team readiness.",
  },
  PROJECT_MANAGER: {
    title: "Project delivery overview",
    body: "Track delivery health and coordinate upcoming project work.",
  },
  DEVELOPER: {
    title: "Your engineering workload",
    body: "Review assigned work, blockers, and project readiness.",
  },
  DESIGNER: {
    title: "Your design workload",
    body: "Review assigned creative work, handoffs, and project readiness.",
  },
  CLIENT: {
    title: "Your project progress",
    body: "Follow project progress and review shared milestones.",
  },
};

const terminalStatuses: ProjectStatus[] = ["COMPLETED", "CANCELLED"];

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function statusTone(status: ProjectStatus) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "ON_HOLD" || status === "WAITING_FOR_FEEDBACK") {
    return "warning" as const;
  }
  if (status === "READY_FOR_WORK" || status === "IN_PROGRESS") {
    return "primary" as const;
  }
  return "default" as const;
}

function isReadyThisWeek(project: Project) {
  if (
    !project.plannedStartDate ||
    project.archivedAt ||
    terminalStatuses.includes(project.status)
  ) {
    return false;
  }

  const plannedStart = new Date(project.plannedStartDate);
  const today = new Date();
  const startOfWeek = new Date(today);
  const day = startOfWeek.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  return plannedStart >= startOfWeek && plannedStart < endOfWeek;
}

export function DashboardOverview() {
  const router = useRouter();
  const { currentUser: user } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const canViewAllProjects =
    user?.role === "SYSTEM_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "PROJECT_MANAGER";

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError("");

    try {
      const pageSize = 100;
      const firstResponse = canViewAllProjects
        ? await projectsApi.list({ page: 1, pageSize })
        : await projectsApi.listMine({ page: 1, pageSize });
      const allProjects = [...firstResponse.items];
      const totalPages = Math.ceil(firstResponse.total / pageSize);

      for (let page = 2; page <= totalPages; page += 1) {
        const response = canViewAllProjects
          ? await projectsApi.list({ page, pageSize })
          : await projectsApi.listMine({ page, pageSize });
        allProjects.push(...response.items);
      }

      setProjects(allProjects);
      setTotalProjects(firstResponse.total);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load dashboard projects.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [canViewAllProjects, user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const openProjects = projects.filter(
      (project) =>
        !project.archivedAt && !terminalStatuses.includes(project.status),
    ).length;
    const readyThisWeek = projects.filter(isReadyThisWeek).length;
    const internalReviews = projects.filter(
      (project) => project.status === "INTERNAL_REVIEW",
    ).length;
    const waitingForFeedback = projects.filter(
      (project) => project.status === "WAITING_FOR_FEEDBACK",
    ).length;

    return [
      { label: "Open projects", value: openProjects, icon: FolderKanban },
      { label: "Ready this week", value: readyThisWeek, icon: CheckCircle2 },
      { label: "Internal reviews", value: internalReviews, icon: Clock3 },
      {
        label: "Waiting for feedback",
        value: waitingForFeedback,
        icon: MessageSquareText,
      },
    ];
  }, [projects]);

  if (!user) return null;

  const copy = roleCopy[user.role];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Badge tone="primary">{roleLabels[user.role]}</Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-base font-medium text-muted-foreground">
              {copy.body}
            </p>
          </div>
          <div className="rounded-md bg-muted px-4 py-3 text-sm font-bold text-muted-foreground">
            Signed in as {user.email}
          </div>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Dashboard data unavailable</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void loadDashboard()}>
              <RefreshCw size={16} />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-lg" />
            ))
          : metrics.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-muted-foreground">
                      {item.label}
                    </p>
                    <Icon size={20} className="text-primary" />
                  </div>
                  <div className="mt-4 text-3xl font-extrabold">{item.value}</div>
                </div>
              );
            })}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Project state at a glance</h2>
            <p className="text-sm font-medium text-muted-foreground">
              {canViewAllProjects
                ? "Live status across the workspace, excluding archived projects."
                : "Live status across projects visible to your account."}
            </p>
          </div>
          <Badge>
            {totalProjects} project{totalProjects === 1 ? "" : "s"}
          </Badge>
        </div>

        {isLoading ? (
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-5 rounded-md border border-dashed border-border p-8 text-center text-sm font-semibold text-muted-foreground">
            No projects are currently visible.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-border text-xs font-bold uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Project</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Deadline</th>
                  <th className="px-3 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects.slice(0, 8).map((project) => (
                  <tr key={project.id}>
                    <td className="px-3 py-3">
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="font-extrabold text-primary hover:underline"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone(project.status)}>
                        {formatEnumLabel(project.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 font-semibold text-muted-foreground">
                      {project.priority
                        ? formatEnumLabel(project.priority)
                        : "Not shown"}
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2 font-semibold">
                        <CalendarClock
                          size={15}
                          className="text-muted-foreground"
                        />
                        {formatDate(project.deadline)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalProjects > 8 ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm font-semibold text-muted-foreground">
                <span>Showing 8 of {totalProjects} projects.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/dashboard/projects")}
                >
                  View all projects
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
