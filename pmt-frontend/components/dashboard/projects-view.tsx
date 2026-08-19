"use client";

import {
  BriefcaseBusiness,
  CalendarClock,
  Eye,
  Filter,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  type Project,
  type ProjectPriority,
  type ProjectQuery,
  type ProjectStatus,
  type ProjectType,
  projectPriorities,
  projectStatuses,
  projectsApi,
  projectTypes,
} from "@/lib/api/projects";
import { userStore } from "@/lib/api/user-store";
import { roleLabels } from "@/lib/auth-meta";

const PAGE_SIZE = 20;
const ALL_VALUE = "ALL";
const PROJECT_VIEW_ACTIVE = "ACTIVE";
const PROJECT_VIEW_ARCHIVED = "ARCHIVED";

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getProjectTypes(project: Project) {
  return project.projectTypeTags?.map((tag) => tag.type) ?? [];
}

function getStatusTone(status: ProjectStatus) {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "ON_HOLD" || status === "WAITING_FOR_FEEDBACK") return "warning";
  if (status === "IN_PROGRESS" || status === "READY_FOR_WORK") return "primary";
  return "default";
}

function getPriorityTone(priority?: ProjectPriority) {
  if (priority === "CRITICAL" || priority === "URGENT") return "danger";
  if (priority === "HIGH") return "warning";
  if (priority === "MEDIUM") return "primary";
  return "default";
}

export function ProjectsView() {
  const router = useRouter();
  const { currentUser, users } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [overloaded, setOverloaded] = useState(false);
  const [status, setStatus] = useState<ProjectStatus | typeof ALL_VALUE>(ALL_VALUE);
  const [priority, setPriority] = useState<ProjectPriority | typeof ALL_VALUE>(
    ALL_VALUE,
  );
  const [projectType, setProjectType] = useState<ProjectType | typeof ALL_VALUE>(
    ALL_VALUE,
  );
  const [clientId, setClientId] = useState(ALL_VALUE);
  const [search, setSearch] = useState("");
  const [projectView, setProjectView] = useState(
    PROJECT_VIEW_ACTIVE as typeof PROJECT_VIEW_ACTIVE | typeof PROJECT_VIEW_ARCHIVED,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const latestRequestRef = useRef(0);
  const filterPanelRef = useRef<HTMLElement>(null);

  const canManageProjects =
    currentUser?.role === "SYSTEM_ADMIN" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "PROJECT_MANAGER";
  const canUseProjects = Boolean(currentUser);

  const clients = useMemo(
    () =>
      (Array.isArray(users) ? users : [])
        .filter((user) => user.role === "CLIENT" && user.status !== "SUSPENDED")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const loadProjects = useCallback(
    async (query: ProjectQuery = {}) => {
      if (!currentUser) return;
      const requestId = ++latestRequestRef.current;
      setIsLoading(true);
      setError("");

      try {
        const response = canManageProjects
          ? await projectsApi.list({
              page: 1,
              pageSize: PAGE_SIZE,
              ...query,
            })
          : await projectsApi.listMine({ page: 1, pageSize: PAGE_SIZE });
        if (requestId !== latestRequestRef.current) return;
        setProjects(response.items);
        setTotal(response.total);
        setOverloaded(Boolean(response.overloaded));
      } catch (error) {
        if (requestId !== latestRequestRef.current) return;
        setError(
          error instanceof Error ? error.message : "Unable to load projects.",
        );
      } finally {
        if (requestId === latestRequestRef.current) setIsLoading(false);
      }
    },
    [canManageProjects, currentUser],
  );

  useEffect(() => {
    void userStore.loadCurrentUser();
  }, []);

  useEffect(() => {
    if (canManageProjects) {
      void userStore.loadUsers();
    }
  }, [canManageProjects]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const timeoutId = window.setTimeout(() => {
      void loadProjects();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [currentUser, loadProjects]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadProjects({
      status,
      priority,
      clientId,
      projectTypes: projectType === ALL_VALUE ? undefined : [projectType],
      archived: projectView === PROJECT_VIEW_ARCHIVED ? true : undefined,
      search: search.trim() || undefined,
    });
  }

  function handleReset() {
    setStatus(ALL_VALUE);
    setPriority(ALL_VALUE);
    setProjectType(ALL_VALUE);
    setClientId(ALL_VALUE);
    setSearch("");
    setProjectView(PROJECT_VIEW_ACTIVE);
    void loadProjects({ search: undefined });
  }

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (!canUseProjects) {
    return (
      <Alert variant="warning">
        <AlertTitle>Projects unavailable</AlertTitle>
        <AlertDescription>
          Your current role does not have project workspace access.
        </AlertDescription>
      </Alert>
    );
  }

  const activeCount = projects.filter(
    (project) =>
      !["COMPLETED", "CANCELLED"].includes(project.status) && !project.archivedAt,
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge tone="primary">{roleLabels[currentUser.role]}</Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
              Projects
            </h1>
            <p className="mt-2 max-w-3xl text-base font-medium text-muted-foreground">
              {canManageProjects
                ? "Manage project delivery, review staffing, and keep milestones on track."
                : currentUser.role === "CLIENT"
                  ? "View project status, upcoming milestones, and delivery documents for your account."
                  : "Track assigned work, upcoming milestones, and delivery progress."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{total} total</Badge>
            <Badge tone={activeCount > 0 ? "primary" : "default"}>
              {activeCount} active
            </Badge>
            {canManageProjects ? (
              <Button onClick={() => router.push("/dashboard/projects/create")}>
                <Plus size={18} />
                Create project
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {overloaded ? (
        <Alert variant="warning">
          <AlertTitle>Workload needs attention</AlertTitle>
          <AlertDescription>
            Your active project count is above the recommended workload threshold.
          </AlertDescription>
        </Alert>
      ) : null}

      {canManageProjects ? (
        <section
          ref={filterPanelRef}
          id="project-filters"
          className="rounded-lg border border-border bg-card p-5 shadow-sm"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold">Filter projects</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Narrow the project list by name, status, priority, type, client, or view.
              </p>
            </div>
          </div>
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
            onSubmit={handleFilter}
          >
            <div className="space-y-2">
              <label className="text-sm font-bold" htmlFor="project-search">
                Search projects
              </label>
              <Input
                id="project-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by project name"
                icon={<Search size={17} />}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Status</label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as ProjectStatus | typeof ALL_VALUE)
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                  {projectStatuses.map((item) => (
                    <SelectItem key={item} value={item}>
                      {formatEnumLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Priority</label>
              <Select
                value={priority}
                onValueChange={(value) =>
                  setPriority(value as ProjectPriority | typeof ALL_VALUE)
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All priorities</SelectItem>
                  {projectPriorities.map((item) => (
                    <SelectItem key={item} value={item}>
                      {formatEnumLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Type</label>
              <Select
                value={projectType}
                onValueChange={(value) =>
                  setProjectType(value as ProjectType | typeof ALL_VALUE)
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All types</SelectItem>
                  {projectTypes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {formatEnumLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Client</label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name || client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Project view</label>
              <Select
                value={projectView}
                onValueChange={(value) =>
                  setProjectView(
                    value as typeof PROJECT_VIEW_ACTIVE | typeof PROJECT_VIEW_ARCHIVED,
                  )
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROJECT_VIEW_ACTIVE}>Active projects</SelectItem>
                  <SelectItem value={PROJECT_VIEW_ARCHIVED}>
                    Archived projects
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end border-t border-border pt-4 md:col-span-2 xl:col-span-3 2xl:col-span-6">
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleReset}>
                  <RotateCcw size={16} />
                  Reset filters
                </Button>
                <Button type="submit" className="min-w-36">
                  Apply filters
                </Button>
              </div>
            </div>
          </form>
        </section>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load projects</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold">Project pipeline</h2>
            <p className="text-sm font-medium text-muted-foreground">
              {canManageProjects
                ? projectView === PROJECT_VIEW_ARCHIVED
                  ? "Review archived projects preserved for historical reference."
                  : "Review project status, priorities, staffing, and delivery milestones in one place."
                : currentUser.role === "CLIENT"
                  ? "View the current status and delivery milestones for projects associated with your account."
                  : "View assigned projects, current status, and upcoming delivery milestones."}
            </p>
          </div>
          {canManageProjects ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Open project filters"
              title="Open project filters"
              onClick={() => {
                filterPanelRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                document.getElementById("project-search")?.focus({
                  preventScroll: true,
                });
              }}
            >
              <Filter size={19} />
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <BriefcaseBusiness size={40} className="text-muted-foreground" />
            <h3 className="mt-4 text-xl font-extrabold">No projects found</h3>
            <p className="mt-2 max-w-md text-sm font-medium text-muted-foreground">
              {canManageProjects
                ? "Create the first project or adjust the filters to widen the list."
                : "There are no projects visible to your account yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted text-xs font-bold uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Project</th>
                  <th className="px-5 py-4">Client</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Priority</th>
                  <th className="px-5 py-4">Types</th>
                  <th className="px-5 py-4">Planned start</th>
                  <th className="px-5 py-4">Deadline</th>
                  <th className="px-5 py-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects.map((project) => {
                  const types = getProjectTypes(project);
                  return (
                    <tr
                      key={project.id}
                      className={project.archivedAt ? "align-top bg-muted/30" : "align-top"}
                    >
                      <td className="max-w-[260px] px-5 py-4">
                        <div className="font-extrabold text-foreground">
                          {project.name}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs font-medium text-muted-foreground">
                          {project.description || "No description added"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold">
                          {project.client?.name || "Client"}
                        </div>
                        <div className="mt-1 text-xs font-medium text-muted-foreground">
                          {project.client?.email || "Restricted view"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={getStatusTone(project.status)}>
                            {formatEnumLabel(project.status)}
                          </Badge>
                          {project.archivedAt ? <Badge>Archived</Badge> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {project.priority ? (
                          <Badge tone={getPriorityTone(project.priority)}>
                            {formatEnumLabel(project.priority)}
                          </Badge>
                        ) : (
                          <span className="text-sm font-semibold text-muted-foreground">
                            Not shown
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex max-w-[220px] flex-wrap gap-1.5">
                          {types.length ? (
                            types.map((type) => (
                              <Badge key={type}>{formatEnumLabel(type)}</Badge>
                            ))
                          ) : (
                            <span className="text-sm font-semibold text-muted-foreground">
                              No tags
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 font-semibold">
                          <CalendarClock size={16} className="text-muted-foreground" />
                          {formatDate(project.plannedStartDate)}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold">
                        {formatDate(project.deadline)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/dashboard/projects/${project.id}`)
                          }
                        >
                          <Eye size={16} />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
