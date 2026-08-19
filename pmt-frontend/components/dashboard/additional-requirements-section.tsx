"use client";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardPlus,
  Loader2,
  Plus,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  additionalRequirementsApi,
  type AdditionalRequirement,
  type AdditionalRequirementStatus,
} from "@/lib/api/additional-requirements";
import type { Project } from "@/lib/api/projects";

const ALL_STATUS = "ALL";

const STATUS_LABELS: Record<AdditionalRequirementStatus, string> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not reviewed";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: AdditionalRequirementStatus) {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

function personName(person?: AdditionalRequirement["uploadedBy"]) {
  return person?.name || person?.email || "Workspace user";
}

export function AdditionalRequirementsSection({
  project,
  canManage,
}: {
  project: Project;
  canManage: boolean;
}) {
  const [requirements, setRequirements] = useState<AdditionalRequirement[]>([]);
  const [statusFilter, setStatusFilter] = useState<typeof ALL_STATUS | AdditionalRequirementStatus>(
    ALL_STATUS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [sourceChannel, setSourceChannel] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [reviewing, setReviewing] = useState<AdditionalRequirement | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [additionalHours, setAdditionalHours] = useState("");
  const [extensionDays, setExtensionDays] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

  const loadRequirements = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setLoadError("");

      try {
        const result = await additionalRequirementsApi.list(project.id, {
          page: 1,
          pageSize: 100,
          status: statusFilter,
        });
        setRequirements(result.items);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load additional requirements.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [project.id, statusFilter],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRequirements(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRequirements]);

  const pendingCount = useMemo(
    () => requirements.filter((item) => item.status === "PENDING_REVIEW").length,
    [requirements],
  );

  function openCreateDialog() {
    setDescription("");
    setSourceChannel("");
    setCreateError("");
    setIsCreateOpen(true);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDescription = description.trim();
    const trimmedSource = sourceChannel.trim();

    if (!trimmedDescription) {
      setCreateError("Describe the requested change before logging it.");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    try {
      await additionalRequirementsApi.create(project.id, {
        description: trimmedDescription,
        sourceChannel: trimmedSource || undefined,
      });
      toast.success("Additional requirement logged", {
        description: "It is now waiting for PM review.",
      });
      setIsCreateOpen(false);
      await loadRequirements(true);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Unable to log the requirement.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function openReviewDialog(requirement: AdditionalRequirement) {
    setReviewing(requirement);
    setDecision("APPROVED");
    setAdditionalHours("");
    setExtensionDays("");
    setReviewError("");
  }

  const parsedHours = additionalHours.trim() ? Number(additionalHours) : undefined;
  const parsedDays = extensionDays.trim() ? Number(extensionDays) : undefined;
  const hasValidHours = parsedHours === undefined || (Number.isFinite(parsedHours) && parsedHours >= 0);
  const hasValidDays = parsedDays === undefined || (Number.isInteger(parsedDays) && parsedDays >= 1);
  const projectedHours =
    parsedHours === undefined ? project.estimatedHours : (project.estimatedHours ?? 0) + parsedHours;
  const projectedDeadline =
    parsedDays === undefined || !project.deadline
      ? project.deadline
      : new Date(new Date(project.deadline).getTime() + parsedDays * 24 * 60 * 60 * 1000).toISOString();

  async function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewing) return;

    if (decision === "APPROVED" && (!hasValidHours || !hasValidDays)) {
      setReviewError("Enter valid non-negative hours and a whole number of days (minimum 1).");
      return;
    }

    setIsReviewing(true);
    setReviewError("");
    try {
      await additionalRequirementsApi.review(project.id, reviewing.id, {
        decision,
        ...(decision === "APPROVED" && parsedHours !== undefined
          ? { approvedAdditionalHours: parsedHours }
          : {}),
        ...(decision === "APPROVED" && parsedDays !== undefined
          ? { deadlineExtensionDays: parsedDays }
          : {}),
      });
      toast.success(`Requirement ${decision === "APPROVED" ? "approved" : "rejected"}`);
      setReviewing(null);
      await loadRequirements(true);
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Unable to review the requirement.",
      );
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <ClipboardPlus size={21} className="mt-0.5 text-primary" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold">Additional requirements</h2>
              {statusFilter === ALL_STATUS && pendingCount > 0 ? (
                <Badge tone="warning">{pendingCount} pending</Badge>
              ) : null}
            </div>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
              Track requests received outside the original scope. Approved changes can add hours and extend the deadline.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>All statuses</SelectItem>
              <SelectItem value="PENDING_REVIEW">Pending review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void loadRequirements(true)} disabled={isRefreshing} aria-label="Refresh additional requirements">
            <RotateCcw size={17} className={isRefreshing ? "animate-spin" : ""} />
          </Button>
          {canManage ? (
            <Button onClick={openCreateDialog}>
              <Plus size={18} />
              Log requirement
            </Button>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <Alert variant="destructive">
          <AlertCircle size={17} />
          <AlertTitle>Requirements unavailable</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {loadError}
            <Button size="sm" variant="outline" onClick={() => void loadRequirements(true)}>Try again</Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      ) : requirements.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <ClipboardPlus size={30} className="mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-extrabold">No additional requirements</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {statusFilter === ALL_STATUS ? "Requests logged from outside the original scope will appear here." : "No requirements match this status."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requirements.map((requirement) => (
            <article key={requirement.id} className="rounded-md border border-border bg-muted/20 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(requirement.status)}>{STATUS_LABELS[requirement.status]}</Badge>
                    {requirement.sourceChannel ? <Badge>{requirement.sourceChannel}</Badge> : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6">{requirement.description}</p>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    Logged by {personName(requirement.uploadedBy)} · {formatDateTime(requirement.createdAt)}
                  </p>
                </div>
                {canManage && requirement.status === "PENDING_REVIEW" ? (
                  <Button variant="secondary" onClick={() => openReviewDialog(requirement)}>
                    <CheckCircle2 size={17} />
                    Review
                  </Button>
                ) : null}
              </div>
              {requirement.status !== "PENDING_REVIEW" ? (
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-xs font-semibold text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <span>Reviewed by {personName(requirement.reviewedBy)} · {formatDateTime(requirement.reviewedAt)}</span>
                  {requirement.status === "APPROVED" &&
                  (requirement.approvedAdditionalHours !== null &&
                    requirement.approvedAdditionalHours !== undefined ||
                    requirement.deadlineExtensionDays !== null &&
                    requirement.deadlineExtensionDays !== undefined) ? (
                    <span className="text-foreground">
                      Applied: {requirement.approvedAdditionalHours ?? 0}h
                      {requirement.deadlineExtensionDays ? ` +${requirement.deadlineExtensionDays} day${requirement.deadlineExtensionDays === 1 ? "" : "s"}` : ""}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={(open) => !isCreating && setIsCreateOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log an additional requirement</DialogTitle>
            <DialogDescription>
              Capture the request as received. It will remain pending until a PM reviews its scope and impact.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <label className="text-sm font-bold" htmlFor="additional-requirement-description">Requirement</label>
              <Textarea id="additional-requirement-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What did the client or stakeholder request?" rows={5} maxLength={4000} required />
              <p className="text-xs font-semibold text-muted-foreground">Be specific enough that the reviewer can assess scope and impact.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold" htmlFor="additional-requirement-source">Source channel <span className="font-medium text-muted-foreground">(optional)</span></label>
              <Input id="additional-requirement-source" value={sourceChannel} onChange={(event) => setSourceChannel(event.target.value)} placeholder="Email, phone call, Upwork, Fiverr" maxLength={120} />
            </div>
            {createError ? <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isCreating} onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreating || !description.trim()}>{isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}{isCreating ? "Logging..." : "Log requirement"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !isReviewing && !open && setReviewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Review additional requirement</DialogTitle>
            <DialogDescription>Choose a decision. Approval adjustments are additive to the current project plan.</DialogDescription>
          </DialogHeader>
          {reviewing ? (
            <form className="space-y-5" onSubmit={handleReview}>
              <div className="rounded-md border border-border bg-muted p-4">
                <div className="text-xs font-extrabold uppercase text-muted-foreground">Requested change</div>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6">{reviewing.description}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Decision</label>
                <Select value={decision} onValueChange={(value) => setDecision(value as typeof decision)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPROVED">Approve requirement</SelectItem>
                    <SelectItem value="REJECTED">Reject requirement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {decision === "APPROVED" ? (
                <div className="space-y-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                  <div className="flex gap-2 text-sm font-extrabold text-emerald-800 dark:text-emerald-200"><CheckCircle2 size={18} /> Optional project impact</div>
                  <p className="text-xs font-semibold leading-5 text-emerald-800/80 dark:text-emerald-200/80">Leave both blank if the requirement is approved without changing the estimate or deadline.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><label className="text-sm font-bold" htmlFor="approved-additional-hours">Additional hours</label><Input id="approved-additional-hours" type="number" min="0" step="0.25" value={additionalHours} onChange={(event) => setAdditionalHours(event.target.value)} placeholder="0" /></div>
                    <div className="space-y-2"><label className="text-sm font-bold" htmlFor="deadline-extension-days">Deadline extension (days)</label><Input id="deadline-extension-days" type="number" min="1" step="1" value={extensionDays} onChange={(event) => setExtensionDays(event.target.value)} placeholder="0" /></div>
                  </div>
                  {(parsedHours !== undefined || parsedDays !== undefined) && hasValidHours && hasValidDays ? (
                    <div className="border-t border-emerald-200 pt-3 text-xs font-bold text-emerald-900 dark:border-emerald-800 dark:text-emerald-100">
                      <div>New estimate: {projectedHours === undefined || projectedHours === null ? "Not set" : `${projectedHours}h`}</div>
                      <div>New deadline: {parsedDays !== undefined && !project.deadline ? "Calculated from today by the backend" : formatDate(projectedDeadline)}</div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Alert variant="warning"><XCircle size={17} /><AlertDescription>Rejecting records the decision only. Hours and deadline adjustments will not be sent.</AlertDescription></Alert>
              )}
              {reviewError ? <Alert variant="destructive"><AlertDescription>{reviewError}</AlertDescription></Alert> : null}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isReviewing} onClick={() => setReviewing(null)}>Cancel</Button>
                <Button type="submit" variant={decision === "REJECTED" ? "outline" : "default"} disabled={isReviewing || (decision === "APPROVED" && (!hasValidHours || !hasValidDays))}>{isReviewing ? <Loader2 size={18} className="animate-spin" /> : decision === "APPROVED" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{isReviewing ? "Saving..." : decision === "APPROVED" ? "Approve requirement" : "Reject requirement"}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
