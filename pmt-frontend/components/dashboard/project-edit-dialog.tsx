"use client";

import { AlertCircle, Loader2, Pencil, Save } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { projectsApi, type Project, type UpdateProjectInput } from "@/lib/api/projects";

type ProjectEditForm = {
  name: string;
  description: string;
  plannedStartDate: string;
  deadline: string;
};

function toDateInputValue(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function formFromProject(project: Project): ProjectEditForm {
  return {
    name: project.name,
    description: project.description ?? "",
    plannedStartDate: toDateInputValue(project.plannedStartDate),
    deadline: toDateInputValue(project.deadline),
  };
}

function formatDate(value: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function changedFields(
  initial: ProjectEditForm,
  current: ProjectEditForm,
): UpdateProjectInput {
  const changes: UpdateProjectInput = {};
  if (current.name !== initial.name) changes.name = current.name.trim();
  if (current.description !== initial.description) {
    changes.description = current.description.trim();
  }
  if (current.plannedStartDate !== initial.plannedStartDate) {
    changes.plannedStartDate = current.plannedStartDate;
  }
  if (current.deadline !== initial.deadline) changes.deadline = current.deadline;
  return changes;
}

export function ProjectEditDialog({
  project,
  canEdit,
  onSaved,
}: {
  project: Project;
  canEdit: boolean;
  onSaved: (project: Project) => void;
}) {
  const initialForm = useMemo(() => formFromProject(project), [project]);
  const [form, setForm] = useState<ProjectEditForm>(initialForm);
  const [isOpen, setIsOpen] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!canEdit) return null;

  const changes = changedFields(initialForm, form);
  const hasChanges = Object.keys(changes).length > 0;
  const hasExistingPlannedStart = Boolean(project.plannedStartDate);
  const hasExistingDeadline = Boolean(project.deadline);
  const hasInvalidDateRange =
    Boolean(form.plannedStartDate && form.deadline) &&
    form.deadline < form.plannedStartDate;
  const attemptsToClearExistingDate =
    (hasExistingPlannedStart && !form.plannedStartDate) ||
    (hasExistingDeadline && !form.deadline);
  const isValid =
    Boolean(form.name.trim()) &&
    !hasInvalidDateRange &&
    !attemptsToClearExistingDate;

  function openDialog() {
    setForm(formFromProject(project));
    setError("");
    setIsOpen(true);
  }

  function requestClose() {
    if (isSaving) return;
    if (hasChanges) {
      setIsDiscardOpen(true);
      return;
    }
    setIsOpen(false);
  }

  function discardChanges() {
    setIsDiscardOpen(false);
    setIsOpen(false);
    setForm(formFromProject(project));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || !hasChanges) return;

    setError("");
    setIsSaving(true);
    try {
      const updated = await projectsApi.update(project.id, changes);
      onSaved(updated);
      setIsOpen(false);
      setForm(formFromProject(updated));
      toast.success("Project details updated", {
        description: "The project timeline has recorded the change.",
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update project details.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog}>
        <Pencil size={17} />
        Edit details
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (open) setIsOpen(true);
          else requestClose();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit project details</DialogTitle>
            <DialogDescription>
              Update the project information used by the team. Saving creates a project activity record.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-bold" htmlFor="project-edit-name">
                Project name
              </label>
              <Input
                id="project-edit-name"
                value={form.name}
                maxLength={200}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold" htmlFor="project-edit-description">
                Description <span className="font-medium text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="project-edit-description"
                value={form.description}
                maxLength={4000}
                rows={5}
                placeholder="Describe the project scope and intended outcome."
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold" htmlFor="project-edit-planned-start">
                  Planned start
                </label>
                <Input
                  id="project-edit-planned-start"
                  type="date"
                  value={form.plannedStartDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      plannedStartDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold" htmlFor="project-edit-deadline">
                  Deadline
                </label>
                <Input
                  id="project-edit-deadline"
                  type="date"
                  min={form.plannedStartDate || undefined}
                  value={form.deadline}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      deadline: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {attemptsToClearExistingDate ? (
              <Alert variant="warning">
                <AlertCircle size={17} />
                <AlertTitle>Existing dates cannot be cleared here</AlertTitle>
                <AlertDescription>
                  The current backend supports changing these dates but not clearing an existing date. Leave the current value unchanged or choose a replacement date.
                </AlertDescription>
              </Alert>
            ) : null}

            {hasInvalidDateRange ? (
              <Alert variant="destructive">
                <AlertDescription>
                  The deadline cannot be earlier than the planned start date.
                </AlertDescription>
              </Alert>
            ) : null}

            {hasChanges && isValid ? (
              <div className="rounded-md border border-border bg-muted p-4">
                <div className="text-xs font-extrabold uppercase text-muted-foreground">
                  Changes to save
                </div>
                <div className="mt-3 space-y-2 text-sm font-semibold">
                  {changes.name !== undefined ? <div><span className="text-muted-foreground">Name:</span> {initialForm.name} → {changes.name}</div> : null}
                  {changes.description !== undefined ? <div><span className="text-muted-foreground">Description:</span> updated</div> : null}
                  {changes.plannedStartDate !== undefined ? <div><span className="text-muted-foreground">Planned start:</span> {formatDate(initialForm.plannedStartDate)} → {formatDate(changes.plannedStartDate)}</div> : null}
                  {changes.deadline !== undefined ? <div><span className="text-muted-foreground">Deadline:</span> {formatDate(initialForm.deadline)} → {formatDate(changes.deadline)}</div> : null}
                </div>
              </div>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSaving} onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !hasChanges || !isValid}>
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDiscardOpen} onOpenChange={setIsDiscardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              Your edits to this project will be lost if you close the form.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button variant="outline" onClick={discardChanges}>
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
