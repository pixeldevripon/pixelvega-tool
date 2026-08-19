"use client";

import { Check, Loader2, Pencil, Save } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  projectTypes as availableProjectTypes,
  projectsApi,
  type Project,
  type ProjectType,
} from "@/lib/api/projects";

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function currentProjectTypes(project: Project) {
  return project.projectTypeTags?.map((tag) => tag.type) ?? [];
}

function sameTypes(left: ProjectType[], right: ProjectType[]) {
  return (
    left.length === right.length && left.every((type, index) => type === right[index])
  );
}

export function ProjectTypesEditDialog({
  project,
  canEdit,
  onSaved,
}: {
  project: Project;
  canEdit: boolean;
  onSaved: (project: Project) => void;
}) {
  const initialTypes = useMemo(() => currentProjectTypes(project), [project]);
  const [selectedTypes, setSelectedTypes] = useState<ProjectType[]>(initialTypes);
  const [isOpen, setIsOpen] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!canEdit) return null;

  const addedTypes = selectedTypes.filter((type) => !initialTypes.includes(type));
  const removedTypes = initialTypes.filter((type) => !selectedTypes.includes(type));
  const hasChanges = !sameTypes(
    [...selectedTypes].sort(),
    [...initialTypes].sort(),
  );
  const isValid = selectedTypes.length > 0;

  function openDialog() {
    setSelectedTypes(currentProjectTypes(project));
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
    setSelectedTypes(currentProjectTypes(project));
    setError("");
  }

  function toggleType(type: ProjectType) {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((selectedType) => selectedType !== type)
        : [...current, type],
    );
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || !hasChanges) return;

    setError("");
    setIsSaving(true);
    try {
      const updated = await projectsApi.updateTypes(project.id, {
        projectTypes: selectedTypes,
      });
      onSaved(updated);
      setIsOpen(false);
      setSelectedTypes(currentProjectTypes(updated));
      toast.success("Project types updated", {
        description: "The project timeline has recorded the change.",
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update project types.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 whitespace-nowrap"
        onClick={openDialog}
      >
        <Pencil size={16} />
        Edit types
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (open) setIsOpen(true);
          else requestClose();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit project types</DialogTitle>
            <DialogDescription>
              Select every type that applies. Saving replaces the project&apos;s complete type set and records the additions/removals in project activity.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <fieldset className="space-y-3">
              <legend className="text-sm font-bold">Available project types</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableProjectTypes.map((type) => {
                  const selected = selectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleType(type)}
                      className={`flex min-h-11 cursor-pointer items-center justify-between rounded-md border px-3.5 text-left text-sm font-bold outline-none transition focus:ring-2 focus:ring-primary/30 ${
                        selected
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-input text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary"
                      }`}
                    >
                      <span>{formatEnumLabel(type)}</span>
                      {selected ? <Check size={17} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs font-semibold text-muted-foreground">
                Choose at least one type. You can select more than one.
              </p>
            </fieldset>

            <div className="rounded-md border border-border bg-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold uppercase text-muted-foreground">
                  Selected types
                </div>
                <Badge tone={isValid ? "primary" : "danger"}>
                  {selectedTypes.length} selected
                </Badge>
              </div>
              {selectedTypes.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedTypes.map((type) => (
                    <Badge key={type}>{formatEnumLabel(type)}</Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300">
                  Select at least one project type before saving.
                </p>
              )}
            </div>

            {hasChanges && isValid ? (
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-xs font-extrabold uppercase text-muted-foreground">
                  Changes to save
                </div>
                <div className="mt-3 space-y-2 text-sm font-semibold">
                  {addedTypes.length ? (
                    <div>
                      <span className="text-muted-foreground">Added:</span>{" "}
                      {addedTypes.map(formatEnumLabel).join(", ")}
                    </div>
                  ) : null}
                  {removedTypes.length ? (
                    <div>
                      <span className="text-muted-foreground">Removed:</span>{" "}
                      {removedTypes.map(formatEnumLabel).join(", ")}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to save project types</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSaving} onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !hasChanges || !isValid}>
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? "Saving..." : "Save types"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDiscardOpen} onOpenChange={setIsDiscardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard unsaved type changes?</DialogTitle>
            <DialogDescription>
              Your project type selections will be lost if you close the form.
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
