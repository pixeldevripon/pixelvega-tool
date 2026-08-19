"use client";

import { ArrowLeft, CalendarClock, FolderPlus, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type ProjectType,
  projectsApi,
  projectTypes,
} from "@/lib/api/projects";
import { userStore } from "@/lib/api/user-store";

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function CreateProject() {
  const router = useRouter();
  const { currentUser, users } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<ProjectType[]>([]);
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreate =
    currentUser?.role === "SYSTEM_ADMIN" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "PROJECT_MANAGER";

  const clients = useMemo(
    () =>
      (Array.isArray(users) ? users : [])
        .filter((user) => user.role === "CLIENT" && user.status !== "SUSPENDED")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  useEffect(() => {
    void userStore.loadCurrentUser();
    void userStore.loadUsers();
  }, []);

  function toggleType(projectType: ProjectType) {
    setSelectedTypes((current) =>
      current.includes(projectType)
        ? current.filter((item) => item !== projectType)
        : [...current, projectType],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    if (!clientId) {
      setError("Select the client this project belongs to.");
      return;
    }

    if (selectedTypes.length === 0) {
      setError("Select at least one project type.");
      return;
    }

    if (deadline && plannedStartDate && deadline < plannedStartDate) {
      setError("Deadline cannot be earlier than the planned start date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const project = await projectsApi.create({
        name: name.trim(),
        clientId,
        description: description.trim(),
        projectTypes: selectedTypes,
        plannedStartDate,
        deadline,
      });
      toast.success("Project created", {
        description: `${project.name} is now in Planning and ready for staffing.`,
      });
      router.push("/dashboard/projects");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to create project.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (!canCreate) {
    return (
      <Alert variant="warning">
        <AlertTitle>Create project unavailable</AlertTitle>
        <AlertDescription>
          Only system admins, admins, and project managers can create projects.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <Button
          variant="ghost"
          className="-ml-3 mb-4"
          onClick={() => router.push("/dashboard/projects")}
        >
          <ArrowLeft size={18} />
          Projects
        </Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge tone="primary">New project</Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
              Create project
            </h1>
            <p className="mt-2 max-w-3xl text-base font-medium text-muted-foreground">
              Projects start in Planning with no team assigned. Staffing and
              status movement happen after the project exists.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm font-bold text-muted-foreground">
            Priority defaults to Medium
          </div>
        </div>
      </section>

      <section className="max-w-5xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold">Project name</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme marketing site rebuild"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Client</label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name || client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients.length === 0 ? (
                <p className="text-xs font-semibold text-muted-foreground">
                  Create an active client user before creating a project.
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">Description</label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Brief scope, business goal, and any important context."
              rows={4}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag size={18} className="text-primary" />
              <label className="text-sm font-bold">Project types</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {projectTypes.map((projectType) => {
                const isSelected = selectedTypes.includes(projectType);
                return (
                  <Button
                    key={projectType}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    aria-pressed={isSelected}
                    onClick={() => toggleType(projectType)}
                  >
                    {formatEnumLabel(projectType)}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              Select every platform or discipline that applies to the work.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold">
                <CalendarClock size={17} className="text-muted-foreground" />
                Planned start date
              </label>
              <Input
                type="date"
                min={todayInputValue()}
                value={plannedStartDate}
                onChange={(event) => setPlannedStartDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold">
                <CalendarClock size={17} className="text-muted-foreground" />
                Deadline
              </label>
              <Input
                type="date"
                min={plannedStartDate || todayInputValue()}
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting || clients.length === 0}>
              <FolderPlus size={18} />
              {isSubmitting ? "Creating..." : "Create project"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/projects")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
